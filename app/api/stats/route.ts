import { fail, ok } from "@/lib/api";
import { getStats } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(getStats());
  } catch (error) {
    return fail(error);
  }
}
