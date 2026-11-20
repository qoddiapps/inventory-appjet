import { fail, HttpError, ok, readJson } from "@/lib/api";
import {
  authenticateAdminPassword,
  createSessionToken,
  isAuthConfigured,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isAuthConfigured()) {
      throw new HttpError(503, "Authentication is not configured");
    }

    const body = await readJson(request);
    const password = body.password;
    if (typeof password !== "string" || password.length === 0 || password.length > 256) {
      throw new HttpError(401, "Invalid credentials");
    }
    if (!authenticateAdminPassword(password)) {
      throw new HttpError(401, "Invalid credentials");
    }

    const token = createSessionToken("admin");
    if (!token) throw new HttpError(503, "Authentication is not configured");

    const response = ok({ authenticated: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    return fail(error);
  }
}
