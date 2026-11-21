import { NextResponse } from "next/server";
import { fail, HttpError, ok, readJson } from "@/lib/api";
import {
  authenticateAdminPassword,
  createSessionToken,
  isAuthConfigured,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  checkLoginRateLimit,
  loginClientKey,
  recordLoginFailure,
  resetLoginFailures,
} from "@/lib/login-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isAuthConfigured()) {
      throw new HttpError(503, "Authentication is not configured");
    }

    const clientId = loginClientKey(request);
    const limit = checkLoginRateLimit(clientId);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(limit.retryAfterSeconds),
          },
        },
      );
    }

    const body = await readJson(request);
    const password = body.password;
    if (typeof password !== "string" || password.length === 0 || password.length > 256) {
      recordLoginFailure(clientId);
      throw new HttpError(401, "Invalid credentials");
    }
    if (!authenticateAdminPassword(password)) {
      recordLoginFailure(clientId);
      throw new HttpError(401, "Invalid credentials");
    }

    const token = createSessionToken("admin");
    if (!token) throw new HttpError(503, "Authentication is not configured");
    resetLoginFailures(clientId);

    const response = ok({ authenticated: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    return fail(error);
  }
}
