import { listCategories } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import { CategoriesManager } from "@/components/CategoriesManager";

export const dynamic = "force-dynamic";

export default function CategoriesPage() {
  const categories = listCategories();

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Categories"
        description="Group products into logical families to keep reporting and picking simple."
      />
      <CategoriesManager categories={categories} />
    </div>
  );
}
