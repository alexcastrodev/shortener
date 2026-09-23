export interface LoginPasswordBody {
  email: string;
  password: string;
  turnstile_token?: string;
}
