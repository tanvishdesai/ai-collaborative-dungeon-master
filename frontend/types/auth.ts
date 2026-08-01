export interface AuthUser {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}
