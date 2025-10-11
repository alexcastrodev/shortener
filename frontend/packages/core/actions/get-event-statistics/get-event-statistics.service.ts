import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  EventStatistics,
  GetEventStatisticsResponse,
} from './get-event-statistics.types';

export async function getEventStatistics(
  id: number | string
): Promise<EventStatistics> {
  try {
    const response: AxiosResponse<GetEventStatisticsResponse> = await api.get(
      `/api/me/shortlinks/${id}/statistics`
    );

    return response.data;
  } catch (error) {
    throw error;
  }
}
