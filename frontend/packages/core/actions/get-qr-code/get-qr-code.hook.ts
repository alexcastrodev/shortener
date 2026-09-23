import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getQrCode } from './get-qr-code.service';
import type { GetQrCodeParams } from './get-qr-code.types';

export function useGetQrCode(params: GetQrCodeParams, queryClient?: QueryClient) {
  return useQuery<Blob, ResponseError>(
    {
      queryKey: ['qr-code', params.resource, String(params.id)],
      queryFn: () => getQrCode(params),
    },
    queryClient
  );
}
