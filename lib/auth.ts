import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./api";

export const SESSION_COOKIE = "stockroom_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const MIN_SECRET_BYTES = 32;
const MIN_PASSWORD_LENGTH = 12;
const MAX_TOKEN_LENGTH = 2048;

export type Role = "admin" | "viewer";

export type Session = {
  role: Role;
  exp: number;
};

function sessionSecret(): string | null {
  const secret = process.env.STOCKROOM_SESSION_SECRET;
  return secret && Buffer.byteLength(secret, "utf8") >= MIN_SECRET_BYTES ? secret : null;
}

export function isAuthConfigured(): boolean {
  const password = process.env.STOCKROOM_ADMIN_PASSWORD;
  return Boolean(password && password.length >= MIN_PASSWORD_LENGTH && sessionSecret());
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Compare the supplied password without leaking its length through timing. */
export function authenticateAdminPassword(input: string): boolean {
  const expected = process.env.STOCKROOM_ADMIN_PASSWORD;
  if (!expected || expected.length < MIN_PASSWORD_LENGTH || !sessionSecret()) return false;
  return timingSafeEqual(digest(input), digest(expected));
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(role: Role): string | null {
  const secret = sessionSecret();
  if (!secret) return null;

  const session: Session & { v: 1 } = {
    v: 1,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function readSessionToken(token: string | null | undefined): Session | null {
  if (!token || token.length > MAX_TOKEN_LENGTH || !isAuthConfigured()) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const secret = sessionSecret();
  if (!secret) return null;

  const expected = Buffer.from(sign(payload, secret), "utf8");
  const supplied = Buffer.from(signature, "utf8");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;

    const session = parsed as Partial<Session> & { v?: unknown };
    if (session.v !== 1) return null;
    if (session.role !== "admin" && session.role !== "viewer") return null;
    if (typeof session.exp !== "number" || !Number.isInteger(session.exp)) return null;
    if (session.exp <= Math.floor(Date.now() / 1000)) return null;

    return { role: session.role, exp: session.exp };
  } catch {
    return null;
  }
}

export function readSession(request: Request): Session | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    return readSessionToken(part.slice(separator + 1).trim());
  }

  return null;
}

/** Shared role check used by API and server-rendered route guards. */
export function sessionHasRole(session: Session | null, role: Role): boolean {
  return session?.role === role;
}

/** Central fail-closed guard used by every inventory API handler. */
export function requireApiRole(request: Request, role: Role): Session {
  const session = readSession(request);
  if (!session) throw new HttpError(401, "Authentication required");
  if (!sessionHasRole(session, role)) throw new HttpError(403, "Insufficient permissions");
  return session;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
