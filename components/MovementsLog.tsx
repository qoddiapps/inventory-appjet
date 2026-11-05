"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product, StockMovement } from "@/lib/types";
import { dateTime } from "@/lib/format";
import { Alert, Badge, EmptyState, Field, Modal } from "./ui";
import { MovementForm } from "./MovementForm";

const TYPE_LABEL: Record<StockMovement["type"], string> = {
  in: "Stock in",
  out: "Stock out",
  adjust: "Adjustment",
};

const TYPE_TONE: Record<StockMovement["type"], "success" | "danger" | "brand"> = {
  in: "success",
  out: "danger",
  adjust: "brand",
};

export function MovementsLog({
  movements,
  products,
}: {
  movements: StockMovement[];
  products: Product[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | StockMovement["type"]>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickedId, setPickedId] = useState("");
  const [moving, setMoving] = useState<Product | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return movements.filter((movement) => {
      if (filter !== "all" && movement.type !== filter) return false;
      if (!term) return true;
      return `${movement.product_name ?? ""} ${movement.product_sku ?? ""} ${movement.reason ?? ""} ${
        movement.reference ?? ""
      }`
        .toLowerCase()
        .includes(term);
    });
  }, [movements, filter, search]);

  const picked = products.find((product) => String(product.id) === pickedId) ?? null;

  async function remove(movement: StockMovement) {
    if (
      !confirm(
        `Delete this ${TYPE_LABEL[movement.type].toLowerCase()} entry? The product's stock level is recalculated.`,
      )
    ) {
      return;
    }
    setDeletingId(movement.id);
    setError(null);
    try {
      const response = await fetch(`/api/movements/${movement.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Could not delete movement");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete movement");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input max-w-xs"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, reason or reference…"
            aria-label="Search movements"
          />
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {(["all", "in", "out", "adjust"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === option ? "bg-brand-500/20 text-brand-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {option === "all" ? "All" : option === "adjust" ? "Adjust" : option}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setPickedId(products[0] ? String(products[0].id) : "");
            setPicking(true);
          }}
          disabled={products.length === 0}
        >
          + Record movement
        </button>
      </div>

      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            title={movements.length === 0 ? "No stock movements yet" : "No movements match your filters"}
            description={
              movements.length === 0
                ? "Record your first receipt, shipment or stock count."
                : "Adjust the search or type filter to see more history."
            }
          />
        ) : (
          <>
            <div className="hidden border-b border-white/8 bg-white/[0.02] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:grid sm:grid-cols-[1.6fr_0.9fr_0.7fr_1.6fr_1.1fr_auto] sm:gap-3">
              <span>Product</span>
              <span>Type</span>
              <span>Change</span>
              <span>Reason</span>
              <span>When</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-white/5">
              {rows.map((movement) => (
                <li
                  key={movement.id}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[1.6fr_0.9fr_0.7fr_1.6fr_1.1fr_auto] sm:items-center sm:gap-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/products/${movement.product_id}`}
                      className="block truncate text-sm font-medium text-white hover:text-brand-400"
                    >
                      {movement.product_name ?? "Unknown product"}
                    </Link>
                    <div className="font-mono text-[11px] text-slate-500">{movement.product_sku}</div>
                  </div>
                  <div>
                    <Badge tone={TYPE_TONE[movement.type]}>{TYPE_LABEL[movement.type]}</Badge>
                  </div>
                  <div
                    className={`text-sm font-semibold tabular-nums ${
                      movement.delta > 0
                        ? "text-emerald-300"
                        : movement.delta < 0
                          ? "text-rose-300"
                          : "text-slate-300"
                    }`}
                  >
                    {movement.delta > 0 ? "+" : ""}
                    {movement.delta}
                  </div>
                  <div className="min-w-0 text-sm text-slate-400">
                    <div className="truncate">{movement.reason ?? <span className="text-slate-600">—</span>}</div>
                    {movement.reference ? (
                      <div className="truncate font-mono text-[11px] text-slate-500">{movement.reference}</div>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-400">{dateTime(movement.created_at)}</div>
                  <div className="flex items-center sm:justify-end">
                    <button
                      type="button"
                      className="btn-danger px-2.5 py-1.5 text-xs"
                      onClick={() => remove(movement)}
                      disabled={deletingId === movement.id}
                    >
                      {deletingId === movement.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Modal
        open={picking}
        onClose={() => setPicking(false)}
        title="Record a stock movement"
        description="Choose the product this movement applies to."
      >
        <div className="space-y-3.5">
          <Field label="Product">
            <select
              className="input"
              value={pickedId}
              onChange={(event) => setPickedId(event.target.value)}
              aria-label="Select product"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — {product.sku} ({product.quantity} on hand)
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPicking(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!picked}
              onClick={() => {
                setMoving(picked);
                setPicking(false);
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </Modal>

      {moving ? (
        <MovementForm
          product={moving}
          onClose={() => setMoving(null)}
          onSaved={() => setError(null)}
        />
      ) : null}
    </div>
  );
}
