import { request } from './apiClient';
import { HealthResponse } from '@ibvap/shared';

export const healthService = {
  async checkHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/health');
  },
};
