import { config } from '../utils/config';
import { ApiErrorResponse } from '@ibvap/shared';

export class ApiError extends Error {
  public code: string;
  public details?: unknown;
  public statusCode: number;

  constructor(message: string, code: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${config.apiBaseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (data && (data as ApiErrorResponse).error) {
        const err = (data as ApiErrorResponse).error;
        throw new ApiError(err.message, err.code, response.status, err.details);
      }
      throw new ApiError(`Request failed with status ${response.status}`, 'HTTP_ERROR', response.status);
    }

    return data as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      err instanceof Error ? err.message : 'Network connection failed',
      'NETWORK_ERROR',
      0
    );
  }
}

export const apiClient = {
  get: <T>(endpoint: string, options: RequestInit = {}) =>
    request<T>(endpoint, { ...options, method: 'GET' }).then((data) => ({ data })),
  post: <T>(endpoint: string, body?: any, options: RequestInit = {}) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).then((data) => ({ data })),
  patch: <T>(endpoint: string, body?: any, options: RequestInit = {}) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).then((data) => ({ data })),
  delete: <T>(endpoint: string, options: RequestInit = {}) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }).then((data) => ({ data })),
};
