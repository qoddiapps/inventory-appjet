"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product, Supplier } from "@/lib/types";
import { currency, number, stockStatus } from "@/lib/format";
import { Badge, EmptyState } from "./ui";
import { ProductForm } from "./ProductForm";
import { MovementForm } from "./MovementForm";

type SortKey = "name" | "quantity" | "value";

export function ProductsTable({
  products,
  categories,
  suppliers,
}: {
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [moving, setMoving] = useState<Product | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (term) {
        const haystack = `${product.name} ${product.sku} ${product.description ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (category && String(product.category_id ?? "") !== category) return false;
      if (supplier && String(product.supplier_id ?? "") !== supplier) return false;
      if (onlyLow && product.quantity > product.reorder_level) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "quantity") return a.quantity - b.quantity;
      if (sort === "value") return b.unit_price * b.quantity - a.unit_price * a.quantity;
      return a.name.localeCompare(b.name);
    });
  }, [products, search, category, supplier, onlyLow, sort]);

  async function remove(product: Product) {
    if (!confirm(`Delete ${product.name} (${product.sku})? This also removes its stock history.`)) return;
    setBusyId(product.id);
    try {
      const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json();
        alert(payload.error ?? "Could not delete product");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setFormOpen(true);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            className="input pl-9"
            placeholder="Search name or SKU…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search products"
          />
        </div>

        <select
          className="input w-auto"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <select
          className="input w-auto"
          value={supplier}
          onChange={(event) => setSupplier(event.target.value)}
          aria-label="Filter by supplier"
        >
          <option value="">All suppliers</option>
          {suppliers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <select
          className="input w-auto"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          aria-label="Sort products"
        >
          <option value="name">Sort: name</option>
          <option value="quantity">Sort: quantity</option>
          <option value="value">Sort: stock value</option>
        </select>

        <button
          type="button"
          onClick={() => setOnlyLow((value) => !value)}
          aria-pressed={onlyLow}
          className={`btn ${
            onlyLow
              ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
              : "btn-ghost"
          }`}
        >
          Low stock only
        </button>

        <button type="button" className="btn-primary ml-auto" onClick={openCreate}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New product
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="border-b border-white/8 bg-white/[0.02]">
              <tr>
                <th className="th">Product</th>
                <th className="th">Category</th>
                <th className="th">Supplier</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Unit price</th>
                <th className="th text-right">Stock value</th>
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => {
                const status = stockStatus(product);
                return (
                  <tr key={product.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.025]">
                    <td className="td">
                      <Link href={`/products/${product.id}`} className="group block">
                        <div className="font-medium text-slate-100 group-hover:text-brand-400">{product.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{product.sku}</div>
                      </Link>
                    </td>
                    <td className="td text-slate-400">{product.category_name ?? "—"}</td>
                    <td className="td text-slate-400">{product.supplier_name ?? "—"}</td>
                    <td className="td text-right tabular-nums">
                      <span className={product.quantity <= product.reorder_level ? "font-semibold text-amber-300" : ""}>
                        {number(product.quantity)}
                      </span>
                      <span className="block text-[11px] text-slate-500">reorder {product.reorder_level}</span>
                    </td>
                    <td className="td text-right tabular-nums">{currency(product.unit_price)}</td>
                    <td className="td text-right tabular-nums text-slate-200">
                      {currency(product.unit_price * product.quantity)}
                    </td>
                    <td className="td">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs"
                          onClick={() => setMoving(product)}
                        >
                          Stock
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs"
                          onClick={() => openEdit(product)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-danger px-2 py-1 text-xs"
                          disabled={busyId === product.id}
                          onClick={() => remove(product)}
                        >
                          {busyId === product.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No products match your filters"
            description="Try clearing the search or filters, or add a new product."
            action={
              <button type="button" className="btn-ghost" onClick={openCreate}>
                Add product
              </button>
            }
          />
        ) : (
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-3 text-xs text-slate-500">
            <span>
              Showing {rows.length} of {products.length} products
            </span>
            <span>
              Filtered stock value{" "}
              <span className="font-medium text-slate-300">
                {currency(rows.reduce((sum, item) => sum + item.unit_price * item.quantity, 0))}
              </span>
            </span>
          </div>
        )}
      </div>

      {formOpen ? (
        <ProductForm
          open={formOpen}
          product={editing}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setFormOpen(false)}
        />
      ) : null}
      {moving ? (
        <MovementForm product={moving} onClose={() => setMoving(null)} />
      ) : null}
    </>
  );
}
