import { assertSameOrigin, fail, ok, parseId, readJson } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { deleteCategory, updateCategory } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = requireApiRole(request, "admin");
    return ok(updateCategory(session, parseId((await params).id), await readJson(request)));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = requireApiRole(request, "admin");
    assertSameOrigin(request);
    deleteCategory(session, parseId((await params).id));
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
