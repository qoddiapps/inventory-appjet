import { fail, ok } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { getStats } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = requireApiRole(request, "admin");
    return ok(getStats(session));
  } catch (error) {
    return fail(error);
  }
}
