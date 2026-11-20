import { fail, ok } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { getStats } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireApiRole(request, "admin");
    return ok(getStats());
  } catch (error) {
    return fail(error);
  }
}
