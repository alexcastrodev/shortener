export interface LoginGoogleBody {
  // The one-time code from Google's popup (authorization code flow).
  code?: string;
  // Or an ID token, when Google renders the button itself.
  credential?: string;
}
