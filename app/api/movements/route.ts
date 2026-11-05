import { fail, ok, readJson } from "@/lib/api";
import { createMovement, listMovements } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("product_id");
    return ok(
      listMovements({
        productId: productId ? Number(productId) : undefined,
        type: url.searchParams.get("type") ?? undefined,
        limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    return ok(createMovement(await readJson(request)), 201);
  } catch (error) {
    return fail(error);
  }
}
