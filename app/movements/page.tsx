import { listMovements, listProducts } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import { MovementsLog } from "@/components/MovementsLog";

export const dynamic = "force-dynamic";

export default function MovementsPage() {
  const movements = listMovements({ limit: 300 });
  const products = listProducts({ sort: "name" });

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
