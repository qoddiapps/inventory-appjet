import { fail, ok, readJson } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { createCategory, listCategories } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = requireApiRole(request, "admin");
    return ok(listCategories(session));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = requireApiRole(request, "admin");
    return ok(createCategory(session, await readJson(request)), 201);
  } catch (error) {
    return fail(error);
  }
}
