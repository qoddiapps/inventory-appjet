import { fail, ok, readJson } from "@/lib/api";
import { createCategory, listCategories } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(listCategories());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    return ok(createCategory(await readJson(request)), 201);
  } catch (error) {
    return fail(error);
  }
}
