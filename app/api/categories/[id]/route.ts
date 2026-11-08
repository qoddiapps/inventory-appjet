import { assertSameOrigin, fail, ok, parseId, readJson } from "@/lib/api";
import { deleteCategory, updateCategory } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    return ok(updateCategory(parseId((await params).id), await readJson(request)));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    deleteCategory(parseId((await params).id));
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
