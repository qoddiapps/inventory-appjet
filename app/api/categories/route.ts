import { fail, ok, readJson } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { createCategory, listCategories } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireApiRole(request, "admin");
    return ok(listCategories());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    requireApiRole(request, "admin");
    return ok(createCategory(await readJson(request)), 201);
  } catch (error) {
    return fail(error);
  }
}
