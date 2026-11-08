import { assertSameOrigin, fail, ok, parseId } from "@/lib/api";
import { deleteMovement } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    deleteMovement(parseId((await params).id));
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
