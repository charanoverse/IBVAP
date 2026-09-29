import {
  CameraTopologyConfig,
  Correlation,
  CorrelationFilterOptions,
} from '@ibvap/shared';
import { apiClient } from './apiClient';

export const correlationService = {
  /**
   * Fetches declarative camera topology graph and scoring parameters
   */
  async getTopology(): Promise<CameraTopologyConfig | null> {
    try {
      const res = await apiClient.get<CameraTopologyConfig>('/correlations/topology');
      return res.data;
    } catch {
      return null;
    }
  },

  /**
   * Fetches correlation candidate records with optional filters
   */
  async getCorrelations(options: CorrelationFilterOptions = {}): Promise<Correlation[]> {
    try {
      const query = new URLSearchParams();
      if (options.state) query.append('state', options.state);
      if (options.cameraId) query.append('cameraId', options.cameraId);
      if (options.sourceCameraId) query.append('sourceCameraId', options.sourceCameraId);
      if (options.targetCameraId) query.append('targetCameraId', options.targetCameraId);
      if (options.eventId) query.append('eventId', options.eventId);
      if (options.minScore !== undefined) query.append('minScore', options.minScore.toString());
      if (options.limit !== undefined) query.append('limit', options.limit.toString());
      if (options.offset !== undefined) query.append('offset', options.offset.toString());

      const res = await apiClient.get<Correlation[]>(`/correlations?${query.toString()}`);
      return res.data || [];
    } catch {
      return [];
    }
  },

  /**
   * Fetches a single correlation by ID
   */
  async getCorrelationById(id: string): Promise<Correlation | null> {
    try {
      const res = await apiClient.get<Correlation>(`/correlations/${id}`);
      return res.data;
    } catch {
      return null;
    }
  },

  /**
   * Fetches all correlations associated with an event ID
   */
  async getCorrelationsByEvent(eventId: string): Promise<Correlation[]> {
    try {
      const res = await apiClient.get<Correlation[]>(`/correlations?eventId=${encodeURIComponent(eventId)}`);
      return res.data || [];
    } catch {
      return [];
    }
  },

  /**
   * Operator accepts a correlation candidate
   */
  async acceptCorrelation(id: string, reviewedBy = 'Operator', reviewNote?: string): Promise<Correlation | null> {
    try {
      const res = await apiClient.patch<Correlation>(`/correlations/${id}/accept`, { reviewedBy, reviewNote });
      return res.data;
    } catch {
      return null;
    }
  },

  /**
   * Operator rejects a correlation candidate
   */
  async rejectCorrelation(id: string, reviewedBy = 'Operator', reviewNote?: string): Promise<Correlation | null> {
    try {
      const res = await apiClient.patch<Correlation>(`/correlations/${id}/reject`, { reviewedBy, reviewNote });
      return res.data;
    } catch {
      return null;
    }
  },

  /**
   * Adds an operator review note to a correlation candidate
   */
  async addNote(id: string, note: string, reviewedBy = 'Operator'): Promise<Correlation | null> {
    try {
      const res = await apiClient.post<Correlation>(`/correlations/${id}/notes`, { note, reviewedBy });
      return res.data;
    } catch {
      return null;
    }
  },
};
