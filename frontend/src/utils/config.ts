export interface FrontendConfig {
  apiBaseUrl: string;
  appName: string;
  version: string;
}

export const config: FrontendConfig = {
  apiBaseUrl: (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || '/api',
  appName: 'IBVAP',
  version: '0.1.0',
};
