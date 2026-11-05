import { fail, ok, parseId, readJson } from "@/lib/api";
import { deleteProduct, getProduct, updateProduct } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    return ok(getProduct(parseId((await params).id)));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    return ok(updateProduct(parseId((await params).id), await readJson(request)));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    deleteProduct(parseId((await params).id));
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
