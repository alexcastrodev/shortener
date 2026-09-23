export interface SignupBody {
  email: string;
  password: string;
  turnstile_token?: string;
}
