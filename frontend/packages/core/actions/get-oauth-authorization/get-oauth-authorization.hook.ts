import { useQuery } from '@tanstack/react-query';
import { getOauthAuthorization } from './get-oauth-authorization.service';
import type {
  OauthAuthorizationError,
  OauthAuthorizationPreview,
} from '../../types/Oauth';

export function useGetOauthAuthorization(query: string) {
  return useQuery<OauthAuthorizationPreview, OauthAuthorizationError>({
    queryKey: ['oauth-authorization', query],
    queryFn: () => getOauthAuthorization(query),
    enabled: query.length > 1,
    retry: false,
    staleTime: Infinity,
  });
}
