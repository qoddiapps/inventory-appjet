import { listCategories, listProducts, listSuppliers } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import { ProductsTable } from "@/components/ProductsTable";

export const dynamic = "force-dynamic";

export default function ProductsPage() {
  const products = listProducts({ sort: "name" });
  const categories = listCategories();
  const suppliers = listSuppliers();

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
