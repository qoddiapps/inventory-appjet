import { assertSameOrigin, fail, ok, parseId, readJson } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { deleteSupplier, updateSupplier } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    requireApiRole(request, "admin");
    return ok(updateSupplier(parseId((await params).id), await readJson(request)));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    requireApiRole(request, "admin");
    assertSameOrigin(request);
    deleteSupplier(parseId((await params).id));
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
