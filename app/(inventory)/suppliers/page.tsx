import { listSuppliers } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import { SuppliersManager } from "@/components/SuppliersManager";
import { requirePageSession } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  await requirePageSession("admin");
  const suppliers = listSuppliers();

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Suppliers"
        description="Track vendors, their contacts and lead times for every product you stock."
      />
      <SuppliersManager suppliers={suppliers} />
    </div>
  );
}
