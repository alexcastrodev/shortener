import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { decideOauthAuthorization } from './decide-oauth-authorization.service';
import type { DecideOauthAuthorizationParams } from './decide-oauth-authorization.service';
import type { OauthAuthorizationError } from '../../types/Oauth';

export function useDecideOauthAuthorization(
  mutationProps?: UseMutationOptions<
    { redirect_to: string },
    OauthAuthorizationError,
    DecideOauthAuthorizationParams,
    unknown
  >
) {
  return useMutation({ mutationFn: decideOauthAuthorization, ...mutationProps });
}
