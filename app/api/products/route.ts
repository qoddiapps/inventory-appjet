import { fail, ok, parseOptionalId, parseProductSort, readJson } from "@/lib/api";
import { createProduct, listProducts } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const categoryId = url.searchParams.get("category_id");
    const supplierId = url.searchParams.get("supplier_id");
    const sort = url.searchParams.get("sort");
    return ok(
      listProducts({
        search: url.searchParams.get("search") ?? undefined,
        categoryId: parseOptionalId(categoryId) ?? null,
        supplierId: parseOptionalId(supplierId) ?? null,
        lowStock: url.searchParams.get("low_stock") === "true",
        sort: parseProductSort(sort),
      }),
    );
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    return ok(createProduct(await readJson(request)), 201);
  } catch (error) {
    return fail(error);
  }
}
