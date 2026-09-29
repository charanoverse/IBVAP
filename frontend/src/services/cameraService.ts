import { request } from './apiClient';
import { ApiSuccessResponse, Camera } from '@ibvap/shared';

export const cameraService = {
  async getCameras(): Promise<Camera[]> {
    const res = await request<ApiSuccessResponse<Camera[]>>('/cameras');
    return res.data;
  },

  async getCameraById(id: string): Promise<Camera> {
    const res = await request<ApiSuccessResponse<Camera>>(`/cameras/${id}`);
    return res.data;
  },
};
