import { listCategories, listProducts, listSuppliers } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import { ProductsTable } from "@/components/ProductsTable";
import { requirePageSession } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const session = await requirePageSession("admin");
  const products = listProducts(session, { sort: "name" });
  const categories = listCategories(session);
  const suppliers = listSuppliers(session);

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description="Create items, search the catalogue and adjust stock through recorded movements."
        actions={
          <a className="btn-ghost" href="/api/export">
            Export CSV
          </a>
        }
      />
      <ProductsTable products={products} categories={categories} suppliers={suppliers} />
    </div>
  );
}
