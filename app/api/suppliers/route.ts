import { fail, ok, readJson } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { createSupplier, listSuppliers } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireApiRole(request, "admin");
    return ok(listSuppliers());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    requireApiRole(request, "admin");
    return ok(createSupplier(await readJson(request)), 201);
  } catch (error) {
    return fail(error);
  }
}
