export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  guestId?: string,
): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, guest_id: guestId ?? null }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail ?? 'Registration failed. Please try again.');
  return body as AuthResponse;
}

export async function loginUser(
  email: string,
  password: string,
  guestId?: string,
): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, guest_id: guestId ?? null }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail ?? 'Login failed. Please try again.');
  return body as AuthResponse;
}
