import { fail, ok, parseLimit, parseMovementType, parseOptionalId, readJson } from "@/lib/api";
import { createMovement, listMovements } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("product_id");
    return ok(
      listMovements({
        productId: parseOptionalId(productId),
        type: parseMovementType(url.searchParams.get("type")),
        limit: parseLimit(url.searchParams.get("limit")),
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
