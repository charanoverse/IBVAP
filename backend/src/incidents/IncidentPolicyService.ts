import fs from 'fs';
import path from 'path';
import { Event, IncidentPolicyConfig, IncidentPolicyRule, IncidentPriority } from '@ibvap/shared';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface EvaluatedIncidentPolicy {
  shouldCreateIncident: boolean;
  priority: IncidentPriority;
  priorityReason: string;
  aggregateWith: string[];
  aggregationWindowSeconds: number;
  title: string;
  explanation: string;
}

export class IncidentPolicyService {
  private policyConfig: IncidentPolicyConfig;

  constructor() {
    this.policyConfig = this.loadPolicyConfig();
  }

  private loadPolicyConfig(): IncidentPolicyConfig {
    const defaultFallback: IncidentPolicyConfig = {
      version: '1.0',
      policies: [
        {
          eventType: 'ZONE_ENTRY',
          ruleType: 'ZONE_ENTRY',
          createIncident: true,
          defaultPriority: 'HIGH',
          priorityReasonTemplate: 'High priority: Sterile / Restricted zone entry breach detected by rule "{ruleName}" on camera {cameraId}.',
          aggregateWith: ['DWELL', 'ZONE_EXIT'],
          aggregationWindowSeconds: 15.0,
        },
        {
          eventType: 'DWELL',
          ruleType: 'DWELL',
          createIncident: true,
          defaultPriority: 'HIGH',
          priorityReasonTemplate: 'High priority: Prolonged dwell / loitering in restricted zone detected by rule "{ruleName}" on camera {cameraId}.',
          aggregateWith: ['ZONE_ENTRY', 'ZONE_EXIT'],
          aggregationWindowSeconds: 15.0,
        },
        {
          eventType: 'WRONG_DIRECTION',
          ruleType: 'WRONG_DIRECTION',
          createIncident: true,
          defaultPriority: 'HIGH',
          priorityReasonTemplate: 'High priority: Unauthorized reverse-direction movement detected by rule "{ruleName}" on camera {cameraId}.',
          aggregateWith: ['LINE_CROSSING'],
          aggregationWindowSeconds: 15.0,
        },
        {
          eventType: 'LINE_CROSSING',
          ruleType: 'LINE_CROSSING',
          createIncident: true,
          defaultPriority: 'MEDIUM',
          priorityReasonTemplate: 'Medium priority: Monitored security line crossing detected by rule "{ruleName}" on camera {cameraId}.',
          aggregateWith: ['REPEATED_CROSSING', 'WRONG_DIRECTION'],
          aggregationWindowSeconds: 15.0,
        },
        {
          eventType: 'REPEATED_CROSSING',
          ruleType: 'REPEATED_CROSSING',
          createIncident: true,
          defaultPriority: 'MEDIUM',
          priorityReasonTemplate: 'Medium priority: Repeated oscillating crossings detected across boundary by rule "{ruleName}" on camera {cameraId}.',
          aggregateWith: ['LINE_CROSSING'],
          aggregationWindowSeconds: 15.0,
        },
        {
          eventType: 'ZONE_EXIT',
          ruleType: 'ZONE_EXIT',
          createIncident: false,
          defaultPriority: 'LOW',
          priorityReasonTemplate: 'Low priority: Target exited perimeter zone on camera {cameraId}.',
          aggregateWith: ['ZONE_ENTRY'],
          aggregationWindowSeconds: 15.0,
        },
      ],
      defaultPolicy: {
        createIncident: true,
        defaultPriority: 'MEDIUM',
        priorityReasonTemplate: 'Security rule "{ruleName}" verified on camera {cameraId}.',
      },
      evidence: {
        preSeconds: 10.0,
        postSeconds: 10.0,
        minEventDurationSeconds: 4.0,
        maxConcurrency: 2,
      },
    };

    try {
      const configPath = path.resolve(config.configPaths.incidentsPath, 'incident_policies.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw) as IncidentPolicyConfig;
        logger.info(`Loaded incident policies from ${configPath} (${parsed.policies.length} rules)`);
        return parsed;
      }
    } catch (err) {
      logger.warn('Failed to load incident policies config file, using built-in defaults:', err);
    }

    return defaultFallback;
  }

  public getPolicyConfig(): IncidentPolicyConfig {
    return this.policyConfig;
  }

  public evaluateEvent(event: Event): EvaluatedIncidentPolicy {
    const eventType = (event.eventType || '').toUpperCase();
    const ruleName = event.ruleName || event.ruleId || 'Security Perimeter Rule';
    const cameraId = event.cameraId;
    const trackLabel = event.trackDisplayId || (event.trackId !== undefined ? `T0${event.trackId}` : 'Target');
    const objClass = event.objectClass || 'object';

    // Find matching policy rule
    const matchedRule: IncidentPolicyRule | undefined = this.policyConfig.policies.find(
      (p) => p.eventType.toUpperCase() === eventType || (p.ruleType && p.ruleType.toUpperCase() === eventType)
    );

    const shouldCreate = matchedRule !== undefined ? matchedRule.createIncident : this.policyConfig.defaultPolicy.createIncident;
    const priority = (matchedRule?.defaultPriority || this.policyConfig.defaultPolicy.defaultPriority || 'MEDIUM').toUpperCase() as IncidentPriority;
    const template = matchedRule?.priorityReasonTemplate || this.policyConfig.defaultPolicy.priorityReasonTemplate;

    const priorityReason = template
      .replace(/{ruleName}/g, ruleName)
      .replace(/{cameraId}/g, cameraId)
      .replace(/{eventType}/g, eventType);

    const aggregateWith = matchedRule?.aggregateWith || [];
    const aggregationWindowSeconds = matchedRule?.aggregationWindowSeconds || 15.0;

    // Generate deterministic objective title
    let title = 'Perimeter Security Event';
    switch (eventType) {
      case 'ZONE_ENTRY':
        title = event.zoneId?.includes('RESTRICTED') || ruleName.toLowerCase().includes('sterile')
          ? 'Restricted Sterile Zone Entry'
          : 'Monitored Zone Entry';
        break;
      case 'DWELL':
        title = ruleName.toLowerCase().includes('sterile') || event.zoneId?.includes('RESTRICTED')
          ? 'Restricted Sterile Zone Dwell'
          : 'Monitored Zone Loitering';
        break;
      case 'LINE_CROSSING':
        title = 'Perimeter Line Crossing';
        break;
      case 'WRONG_DIRECTION':
        title = 'Wrong-Direction Boundary Crossing';
        break;
      case 'REPEATED_CROSSING':
        title = 'Repeated Perimeter Crossing';
        break;
      case 'ZONE_EXIT':
        title = 'Perimeter Zone Egress';
        break;
      default:
        title = ruleName || 'Perimeter Security Activity';
    }

    // High-level factual explanation
    const timeStr = event.videoTimestamp !== undefined ? ` at video offset ${event.videoTimestamp.toFixed(1)}s` : '';
    const explanation = `${objClass.charAt(0).toUpperCase() + objClass.slice(1)} track ${trackLabel} triggered rule "${ruleName}" on ${cameraId}${timeStr}. Priority set to ${priority} per security policy.`;

    return {
      shouldCreateIncident: shouldCreate,
      priority,
      priorityReason,
      aggregateWith,
      aggregationWindowSeconds,
      title,
      explanation,
    };
  }
}

export const incidentPolicyService = new IncidentPolicyService();
