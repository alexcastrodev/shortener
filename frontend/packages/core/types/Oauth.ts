export type OauthAuthorizationPreview = {
  client: { name: string; redirect_host: string };
  scopes: string[];
  email: string;
  resource: string;
};

export type OauthAuthorizationError = {
  status?: number;
  error?: string;
  redirect_to?: string;
};

export type OauthGrant = {
  id: number;
  client_name: string;
  redirect_host: string;
  scopes: string[];
  connected_at: string;
  last_used_at: string | null;
};
