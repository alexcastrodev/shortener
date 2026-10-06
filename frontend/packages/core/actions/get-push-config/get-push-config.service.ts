import { api } from '../api';

export interface PushConfig {
  enabled: boolean;
  public_key: string | null;
}

export async function getPushConfig(): Promise<PushConfig> {
  const response = await api.get<PushConfig>('/api/me/push_config');
  return response.data;
}
