export type LogoutFailureReason = "http" | "invalid-response" | "network";

export type LogoutResult =
  | { ok: true }
  | { ok: false; reason: LogoutFailureReason };

export type LogoutFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Ask the server to expire the session cookie. A caller must not navigate away
 * unless this returns ok, because a failed request leaves the session live.
 */
export async function requestLogout(
  fetcher: LogoutFetcher = fetch,
): Promise<LogoutResult> {
  try {
    const response = await fetcher("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return { ok: false, reason: "http" };

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { ok: false, reason: "invalid-response" };
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      (payload as { authenticated?: unknown }).authenticated !== false
    ) {
      return { ok: false, reason: "invalid-response" };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/**
 * Complete logout only after the server confirms the session cookie was expired.
 * The redirect callback is never invoked when the request fails.
 */
export async function logoutAndRedirect(
  redirect: (path: string) => void,
  fetcher: LogoutFetcher = fetch,
): Promise<boolean> {
  const result = await requestLogout(fetcher);
  if (!result.ok) return false;

  redirect("/login");
  return true;
}
