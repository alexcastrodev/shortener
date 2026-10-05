import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { revokeOauthGrant } from './revoke-oauth-grant.service';

export function useRevokeOauthGrant(
  mutationProps?: UseMutationOptions<void, unknown, number, unknown>
) {
  return useMutation({ mutationFn: revokeOauthGrant, ...mutationProps });
}
