import { assertSameOrigin, fail, ok, parseId } from "@/lib/api";
import { requireApiRole } from "@/lib/auth";
import { deleteMovement } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = requireApiRole(request, "admin");
    assertSameOrigin(request);
    deleteMovement(session, parseId((await params).id));
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
