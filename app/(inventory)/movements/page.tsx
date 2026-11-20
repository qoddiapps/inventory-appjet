import { listMovements, listProducts } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import { MovementsLog } from "@/components/MovementsLog";
import { requirePageSession } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function MovementsPage() {
  const session = await requirePageSession("admin");
  const movements = listMovements(session, { limit: 300 });
  const products = listProducts(session, { sort: "name" });

  return (
    <div>
      <PageHeader
        eyebrow="Warehouse"
        title="Stock movements"
        description="An audit trail of every receipt, shipment and counted adjustment in the warehouse."
        actions={
          <a className="btn-ghost" href="/api/export">
            Export CSV
          </a>
        }
      />
      <MovementsLog movements={movements} products={products} />
    </div>
  );
}
