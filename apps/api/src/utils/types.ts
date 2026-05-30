export interface AuthTokenPayload {
  userId: string;
  companyId: string;
  role: string;
}

export interface AuthRequest extends Express.Request {
  user?: AuthTokenPayload;
}
