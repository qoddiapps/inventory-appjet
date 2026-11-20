import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSessionToken, SESSION_COOKIE, type Session } from "./auth";

export async function getPageSession(): Promise<Session | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Redirect unauthenticated visitors before any server-rendered inventory data is read. */
export async function requirePageSession(): Promise<Session> {
  const session = await getPageSession();
  if (!session) redirect("/login");
  return session;
}
