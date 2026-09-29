import { request } from './apiClient';
import { ApiSuccessResponse, CameraHealth } from '@ibvap/shared';

export interface CameraHealthDetail extends CameraHealth {
  recentTransitions?: Array<{
    id: string;
    camera_id: string;
    previous_state: string;
    new_state: string;
    previous_visibility?: string;
    new_visibility?: string;
    reason: string;
    is_simulated: number;
    timestamp: string;
  }>;
}

export const cameraHealthService = {
  async getAllCamerasHealth(): Promise<Record<string, CameraHealth>> {
    const res = await request<ApiSuccessResponse<Record<string, CameraHealth>>>('/cameras/health');
    return res.data;
  },

  async getCameraHealth(id: string): Promise<CameraHealthDetail> {
    const res = await request<ApiSuccessResponse<CameraHealthDetail>>(`/cameras/${id}/health`);
    return res.data;
  },

  async simulateDegradation(
    id: string,
    type: 'OFFLINE' | 'FREEZE' | 'BLUR' | 'LOW_LIGHT' | 'GLARE' | 'FPS_DROP',
    reason?: string
  ): Promise<CameraHealth> {
    const res = await request<ApiSuccessResponse<CameraHealth>>(`/cameras/${id}/simulate-degradation`, {
      method: 'POST',
      body: JSON.stringify({ type, reason }),
    });
    return res.data;
  },

  async restoreCamera(id: string): Promise<CameraHealth> {
    const res = await request<ApiSuccessResponse<CameraHealth>>(`/cameras/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return res.data;
  },

  async getHealthTransitions(id: string, limit = 20): Promise<any[]> {
    const res = await request<ApiSuccessResponse<any[]>>(`/cameras/${id}/health-transitions?limit=${limit}`);
    return res.data;
  },
};
