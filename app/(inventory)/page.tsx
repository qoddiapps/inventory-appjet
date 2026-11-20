import Link from "next/link";
import { getStats, listMovements } from "@/lib/repo";
import { compactCurrency, currency, dateTime, number, relativeTime } from "@/lib/format";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { StockBadge } from "@/components/StockBadge";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const stats = getStats();
  const movements = listMovements({ limit: 6 });
  const maxValue = Math.max(1, ...stats.category_breakdown.map((row) => row.value));

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Inventory dashboard"
        description="Live snapshot of stock levels, valuation and recent warehouse activity."
        actions={
          <>
            <a className="btn-ghost" href="/api/export">
              Export CSV
            </a>
            <Link className="btn-primary" href="/products">
              Manage products
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Stock value (retail)"
          value={compactCurrency(stats.inventory_retail)}
          hint={`${number(stats.total_units)} units on hand`}
        />
        <StatCard
          label="Cost of inventory"
          value={compactCurrency(stats.inventory_cost)}
          hint={`Potential margin ${currency(stats.inventory_retail - stats.inventory_cost)}`}
          accent="brand"
        />
        <StatCard
          label="Low stock"
          value={number(stats.low_stock_count)}
          hint={`${stats.out_of_stock_count} out of stock`}
          accent={stats.low_stock_count > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Catalogue"
          value={number(stats.product_count)}
          hint={`${stats.category_count} categories · ${stats.supplier_count} suppliers`}
          accent="neutral"
        />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <section className="card p-4 sm:p-5 xl:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Needs attention</h2>
              <p className="text-xs text-slate-500">Items at or below their reorder level, lowest first.</p>
            </div>
            <Link href="/products" className="btn-ghost px-2.5 py-1 text-xs">
              View all
            </Link>
          </div>

          {stats.low_stock.length === 0 ? (
            <EmptyState title="Everything is well stocked" description="No product is at or below its reorder level." />
          ) : (
            <ul className="divide-y divide-white/5">
              {stats.low_stock.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-white/[0.04]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-100">{product.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {product.sku} · {product.category_name ?? "Uncategorised"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums text-amber-300">
                          {number(product.quantity)}
                        </div>
                        <div className="text-[11px] text-slate-500">of {product.reorder_level}</div>
                      </div>
                      <StockBadge product={product} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4 sm:p-5 xl:col-span-2">
          <h2 className="text-sm font-semibold text-white">Value by category</h2>
          <p className="mb-4 text-xs text-slate-500">Retail value of stock currently on hand.</p>

          {stats.category_breakdown.length === 0 ? (
            <EmptyState title="No categories yet" />
          ) : (
            <ul className="space-y-3">
              {stats.category_breakdown.slice(0, 7).map((row) => (
                <li key={row.name}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                    <span className="truncate text-slate-300">{row.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-400">{compactCurrency(row.value)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-400"
                      style={{ width: `${Math.max(4, (row.value / maxValue) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/8 pt-4 text-xs">
            <div>
              <div className="text-slate-500">Units tracked</div>
              <div className="mt-0.5 text-base font-semibold text-white">{number(stats.total_units)}</div>
            </div>
            <div>
              <div className="text-slate-500">Avg. unit value</div>
              <div className="mt-0.5 text-base font-semibold text-white">
                {currency(stats.total_units ? stats.inventory_retail / stats.total_units : 0)}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent stock movements</h2>
            <p className="text-xs text-slate-500">Every change to stock levels is recorded here.</p>
          </div>
          <Link href="/movements" className="btn-ghost px-2.5 py-1 text-xs">
            All movements
          </Link>
        </div>
        <div className="overflow-x-auto">
          {movements.length === 0 ? (
            <EmptyState title="No movements recorded" description="Record stock in, out or a counted adjustment." />
          ) : (
            <table className="w-full min-w-[620px]">
              <thead className="bg-white/[0.02]">
                <tr>
                  <th className="th">Product</th>
                  <th className="th">Type</th>
                  <th className="th text-right">Change</th>
                  <th className="th">Reason</th>
                  <th className="th text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="border-t border-white/5">
                    <td className="td">
                      <Link href={`/products/${movement.product_id}`} className="hover:text-brand-400">
                        {movement.product_name}
                      </Link>
                      <span className="ml-2 font-mono text-[11px] text-slate-500">{movement.product_sku}</span>
                    </td>
                    <td className="td">
                      <Badge tone={movement.type === "in" ? "success" : movement.type === "out" ? "danger" : "brand"}>
                        {movement.type === "in" ? "Stock in" : movement.type === "out" ? "Stock out" : "Adjust"}
                      </Badge>
                    </td>
                    <td className="td text-right tabular-nums">
                      <span className={movement.delta >= 0 ? "text-emerald-300" : "text-rose-300"}>
                        {movement.delta > 0 ? "+" : ""}
                        {movement.delta}
                      </span>
                    </td>
                    <td className="td text-slate-400">{movement.reason ?? "—"}</td>
                    <td className="td text-right text-slate-500" title={dateTime(movement.created_at)}>
                      {relativeTime(movement.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
