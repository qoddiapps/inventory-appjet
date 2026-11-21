import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, listMovements } from "@/lib/repo";
import { currency, dateTime, number, shortDate, stockStatus } from "@/lib/format";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let product;
  try {
    product = getProduct(id);
  } catch {
    notFound();
  }

  const movements = listMovements({ productId: id, limit: 50 });
  const status = stockStatus(product);
  const margin = product.unit_price > 0 ? ((product.unit_price - product.cost_price) / product.unit_price) * 100 : 0;

  return (
    <div>
      <Link href="/products" className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 6l-6 6 6 6" />
        </svg>
        All products
      </Link>

      <PageHeader
        eyebrow={product.category_name ?? "Uncategorised"}
        title={product.name}
        description={product.description ?? undefined}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="On hand" value={number(product.quantity)} hint={`Reorder at ${product.reorder_level}`} accent={status.tone} />
        <StatCard label="Unit price" value={currency(product.unit_price)} hint={`Cost ${currency(product.cost_price)}`} />
        <StatCard label="Stock value" value={currency(product.unit_price * product.quantity)} hint="Retail value on hand" />
        <StatCard label="Margin" value={`${margin.toFixed(1)}%`} hint={`${currency(product.unit_price - product.cost_price)} per unit`} accent="brand" />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Details</h2>
          <dl className="space-y-2.5 text-sm">
            <Row label="SKU" value={<span className="font-mono text-slate-200">{product.sku}</span>} />
            <Row label="Category" value={product.category_name ?? "Uncategorised"} />
            <Row label="Supplier" value={product.supplier_name ?? "No supplier"} />
            <Row label="Location" value={product.location ?? "Unassigned"} />
            <Row label="Created" value={shortDate(product.created_at)} />
            <Row label="Updated" value={shortDate(product.updated_at)} />
          </dl>
        </section>

        <section className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-white/8 px-4 py-3.5">
            <h2 className="text-sm font-semibold text-white">Stock history</h2>
            <p className="text-xs text-slate-500">Every movement recorded for this product.</p>
          </div>
          {movements.length === 0 ? (
            <EmptyState title="No movements yet" description="Use the Stock button on the products page to add stock." />
          ) : (
            <ul className="divide-y divide-white/5">
              {movements.map((movement) => (
                <li key={movement.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={movement.type === "in" ? "success" : movement.type === "out" ? "danger" : "brand"}>
                        {movement.type === "in" ? "In" : movement.type === "out" ? "Out" : "Adjust"}
                      </Badge>
                      <span className={`font-semibold tabular-nums ${movement.delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {movement.delta > 0 ? "+" : ""}
                        {movement.delta}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {movement.reason ?? "No reason given"}
                      {movement.reference ? ` · ${movement.reference}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500" title={dateTime(movement.created_at)}>
                    {dateTime(movement.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-right text-slate-200">{value}</dd>
    </div>
  );
}
