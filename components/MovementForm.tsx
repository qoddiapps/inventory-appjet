"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import { Alert, Field, Modal } from "./ui";

export function MovementForm({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<"in" | "out" | "adjust">("in");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview =
    type === "in"
      ? product.quantity + (Number(quantity) || 0)
      : type === "out"
        ? product.quantity - (Number(quantity) || 0)
        : Number(quantity) || 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          type,
          quantity: Number(quantity),
          reason,
          reference,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not record movement");
      onSaved?.();
      router.refresh();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not record movement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Record movement — ${product.name}`}
      description={`${product.sku} · currently ${product.quantity} in stock`}
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}

        <div className="grid grid-cols-3 gap-2">
          {(["in", "out", "adjust"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              className={`rounded-xl border px-2 py-2.5 text-sm font-medium capitalize transition-colors ${
                type === option
                  ? "border-brand-500/50 bg-brand-500/15 text-brand-400"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]"
              }`}
            >
              {option === "in" ? "Stock in" : option === "out" ? "Stock out" : "Set count"}
            </button>
          ))}
        </div>

        <Field
          label={type === "adjust" ? "New counted quantity" : "Quantity"}
          hint={type === "adjust" ? "The stock level is set to this counted value." : undefined}
        >
          <input
            className="input"
            type="number"
            min={type === "adjust" ? 0 : 1}
            step={1}
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Reason">
            <input
              className="input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Purchase order, customer order…"
            />
          </Field>
          <Field label="Reference">
            <input
              className="input"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="PO-1234"
            />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3 text-sm">
          <span className="text-slate-400">Stock level after saving</span>
          <span className={`font-semibold ${preview < 0 ? "text-rose-300" : "text-white"}`}>{preview}</span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving || preview < 0}>
            {saving ? "Saving…" : "Record movement"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
