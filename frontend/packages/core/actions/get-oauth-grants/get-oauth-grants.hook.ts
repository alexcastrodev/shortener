import { useQuery } from '@tanstack/react-query';
import { getOauthGrants } from './get-oauth-grants.service';

export const getOauthGrantsKey = ['oauth-grants'];

export function useGetOauthGrants() {
  return useQuery({ queryKey: getOauthGrantsKey, queryFn: getOauthGrants });
}
