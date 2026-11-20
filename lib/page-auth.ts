import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { readSessionToken, SESSION_COOKIE, sessionHasRole, type Role, type Session } from "./auth";

export async function getPageSession(): Promise<Session | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Ensures an authenticated session has the requested role before inventory data is read. */
export async function requirePageSession(role: Role): Promise<Session> {
  const session = await getPageSession();
  if (!session) redirect("/login");
  if (!sessionHasRole(session, role)) notFound();
  return session;
}
