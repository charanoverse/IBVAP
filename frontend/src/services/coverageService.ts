import { request } from './apiClient';
import {
  ApiSuccessResponse,
  ZoneCoverageStatus,
  AlternativeViewRecommendation,
  ZoneCoverageConfig,
} from '@ibvap/shared';

export const coverageService = {
  async getCoverageHealth(): Promise<ZoneCoverageStatus[]> {
    const res = await request<ApiSuccessResponse<ZoneCoverageStatus[]>>('/coverage/health');
    return res.data;
  },

  async getZoneCoverage(zoneId: string): Promise<ZoneCoverageStatus> {
    const res = await request<ApiSuccessResponse<ZoneCoverageStatus>>(`/coverage/zones/${zoneId}`);
    return res.data;
  },

  async getAlternativeRecommendations(
    cameraId: string,
    zoneId?: string
  ): Promise<AlternativeViewRecommendation[]> {
    const query = zoneId ? `?zoneId=${encodeURIComponent(zoneId)}` : '';
    const res = await request<ApiSuccessResponse<AlternativeViewRecommendation[]>>(
      `/coverage/alternatives/${cameraId}${query}`
    );
    return res.data;
  },

  async getCoverageConfigs(): Promise<ZoneCoverageConfig[]> {
    const res = await request<ApiSuccessResponse<ZoneCoverageConfig[]>>('/coverage/configs');
    return res.data;
  },
};
