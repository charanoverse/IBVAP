import {
  ApiResponse,
  Evidence,
  Incident,
  IncidentFilterOptions,
  IncidentOutcomeType,
  IncidentTimelineEvent,
} from '@ibvap/shared';
import { apiClient } from './apiClient.js';

export interface IncidentMetrics {
  total: number;
  active: number;
  highPriority: number;
  acknowledged: number;
  closedToday: number;
}

export const incidentService = {
  async getIncidents(options: IncidentFilterOptions = {}): Promise<Incident[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    if (options.state && options.state !== 'ALL') params.set('state', options.state);
    if (options.priority && options.priority !== 'ALL') params.set('priority', options.priority);
    if (options.cameraId && options.cameraId !== 'ALL') params.set('cameraId', options.cameraId);
    if (options.search) params.set('search', options.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<ApiResponse<Incident[]>>(`/api/incidents${query}`);
    if (res.data.success) {
      return res.data.data;
    }
    return [];
  },

  async getMetrics(): Promise<IncidentMetrics> {
    const res = await apiClient.get<ApiResponse<IncidentMetrics>>('/api/incidents/metrics');
    if (res.data.success) {
      return res.data.data;
    }
    return { total: 0, active: 0, highPriority: 0, acknowledged: 0, closedToday: 0 };
  },

  async getIncidentById(id: string): Promise<Incident | null> {
    const res = await apiClient.get<ApiResponse<Incident>>(`/api/incidents/${encodeURIComponent(id)}`);
    if (res.data.success) {
      return res.data.data;
    }
    return null;
  },

  async getIncidentEvidence(id: string): Promise<Evidence | null> {
    try {
      const res = await apiClient.get<ApiResponse<Evidence>>(`/api/incidents/${encodeURIComponent(id)}/evidence`);
      if (res.data.success) {
        return res.data.data;
      }
    } catch {}
    return null;
  },

  async getIncidentTimeline(id: string): Promise<IncidentTimelineEvent[]> {
    try {
      const res = await apiClient.get<ApiResponse<IncidentTimelineEvent[]>>(`/api/incidents/${encodeURIComponent(id)}/timeline`);
      if (res.data.success) {
        return res.data.data;
      }
    } catch {}
    return [];
  },

  async acknowledge(id: string, actorName = 'Demo Operator'): Promise<Incident | null> {
    const res = await apiClient.patch<ApiResponse<Incident>>(`/api/incidents/${encodeURIComponent(id)}/acknowledge`, {
      actorName,
    });
    if (res.data.success) {
      return res.data.data;
    }
    return null;
  },

  async startReview(id: string, actorName = 'Demo Operator'): Promise<Incident | null> {
    const res = await apiClient.patch<ApiResponse<Incident>>(`/api/incidents/${encodeURIComponent(id)}/review`, {
      actorName,
    });
    if (res.data.success) {
      return res.data.data;
    }
    return null;
  },

  async escalate(id: string, reason?: string, actorName = 'Demo Operator'): Promise<Incident | null> {
    const res = await apiClient.patch<ApiResponse<Incident>>(`/api/incidents/${encodeURIComponent(id)}/escalate`, {
      reason,
      actorName,
    });
    if (res.data.success) {
      return res.data.data;
    }
    return null;
  },

  async close(
    id: string,
    outcome: IncidentOutcomeType | string = 'CONFIRMED_ACTIVITY',
    notes?: string,
    actorName = 'Demo Operator'
  ): Promise<Incident | null> {
    const res = await apiClient.patch<ApiResponse<Incident>>(`/api/incidents/${encodeURIComponent(id)}/close`, {
      outcome,
      notes,
      actorName,
    });
    if (res.data.success) {
      return res.data.data;
    }
    return null;
  },

  async addNote(id: string, text: string, actorName = 'Demo Operator'): Promise<Incident | null> {
    const res = await apiClient.post<ApiResponse<Incident>>(`/api/incidents/${encodeURIComponent(id)}/notes`, {
      text,
      actorName,
    });
    if (res.data.success) {
      return res.data.data;
    }
    return null;
  },

  async retryEvidence(id: string): Promise<Evidence | null> {
    const res = await apiClient.post<ApiResponse<Evidence>>(`/api/incidents/${encodeURIComponent(id)}/evidence/retry`, {});
    if (res.data.success) {
      return res.data.data;
    }
    return null;
  },

  async verifyEvidence(evidenceId: string): Promise<{ status: 'MATCH' | 'MISMATCH'; files: any } | null> {
    const res = await apiClient.post<ApiResponse<any>>(`/api/evidence/${encodeURIComponent(evidenceId)}/verify`, {});
    if (res.data.success) {
      return res.data.data;
    }
    return null;
  },
};
