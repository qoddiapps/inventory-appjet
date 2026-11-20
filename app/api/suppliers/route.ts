import { fail, ok, readJson } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { createSupplier, listSuppliers } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = requireApiRole(request, "admin");
    return ok(listSuppliers(session));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = requireApiRole(request, "admin");
    return ok(createSupplier(session, await readJson(request)), 201);
  } catch (error) {
    return fail(error);
  }
}
