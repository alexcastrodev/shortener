import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  PageStatistics,
  PageStatisticsPeriod,
} from './get-page-statistics.types';

export async function getPageStatistics(
  id: number | string,
  days: PageStatisticsPeriod
): Promise<PageStatistics> {
  const response: AxiosResponse<PageStatistics> = await api.get(
    `/api/me/pages/${id}/statistics`,
    { params: { days } }
  );

  return response.data;
}
