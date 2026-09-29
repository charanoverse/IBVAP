/**
 * Rule Engine Domain Boundary (Phase 0 Placeholder)
 *
 * NOTE: Business logic for zone breach, loitering, and dwell detection
 * will be implemented in Phase 3+. This interface establishes the architectural contract.
 */

import { Observation, Event } from '@ibvap/shared';

export interface RuleDefinition {
  id: string;
  name: string;
  eventType: string;
  targetClasses: string[];
  zoneId?: string;
  conditions?: Record<string, unknown>;
  enabled: boolean;
}

export interface IRuleEngine {
  evaluate(observations: Observation[]): Promise<Event[]>;
  loadRules(): Promise<RuleDefinition[]>;
}

export class PlaceholderRuleEngine implements IRuleEngine {
  async evaluate(_observations: Observation[]): Promise<Event[]> {
    // Placeholder - no automated rule evaluation in Phase 0
    return [];
  }

  async loadRules(): Promise<RuleDefinition[]> {
    return [];
  }
}

export const ruleEngine = new PlaceholderRuleEngine();
