import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetQrCodeParams } from './get-qr-code.types';

// The endpoints need the session token, so the SVG is fetched as a Blob
// instead of being linked from an <img src>.
export async function getQrCode({ resource, id }: GetQrCodeParams): Promise<Blob> {
  const response: AxiosResponse<Blob> = await api.get(
    `/api/me/${resource}/${id}/qr_code`,
    { responseType: 'blob' }
  );

  return response.data;
}
