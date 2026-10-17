let held: string | null = null;

export function holdSignupPassword(password: string) {
  held = password;
}

export function heldSignupPassword() {
  return held;
}

export function dropSignupPassword() {
  held = null;
}
