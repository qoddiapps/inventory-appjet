import { listCategories } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import { CategoriesManager } from "@/components/CategoriesManager";
import { requirePageSession } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requirePageSession();
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
