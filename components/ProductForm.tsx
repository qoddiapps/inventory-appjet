"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product, Supplier } from "@/lib/types";
import { Alert, Field, Modal } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
  categories: Category[];
  suppliers: Supplier[];
}

export function ProductForm({ open, onClose, product, categories, suppliers }: Props) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const [form, setForm] = useState(() => ({
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ? String(product.category_id) : "",
    supplier_id: product?.supplier_id ? String(product.supplier_id) : "",
    unit_price: product ? String(product.unit_price) : "",
    cost_price: product ? String(product.cost_price) : "",
    quantity: product ? String(product.quantity) : "0",
    reorder_level: product ? String(product.reorder_level) : "10",
    location: product?.location ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        sku: form.sku,
        name: form.name,
        description: form.description,
        category_id: form.category_id || null,
        supplier_id: form.supplier_id || null,
        unit_price: Number(form.unit_price || 0),
        cost_price: Number(form.cost_price || 0),
        reorder_level: Number(form.reorder_level || 0),
        location: form.location,
      };
      // Quantity is only settable at creation; later changes go through stock movements.
      if (!isEdit) body.quantity = Number(form.quantity || 0);

      const response = await fetch(isEdit ? `/api/products/${product!.id}` : "/api/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not save product");
      router.refresh();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${product!.name}` : "New product"}
      description={isEdit ? "Quantity is managed through stock movements." : "Add an item to your catalogue."}
      width="max-w-2xl"
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SKU">
            <input
              className="input font-mono uppercase"
              required
              minLength={2}
              value={form.sku}
              onChange={(event) => update("sku", event.target.value)}
              placeholder="ELC-1001"
            />
          </Field>
          <Field label="Product name">
            <input
              className="input"
              required
              minLength={2}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="USB-C Cable 2m"
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className="input min-h-[70px] resize-y"
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Short description shown on the product page"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category">
            <select
              className="input"
              value={form.category_id}
              onChange={(event) => update("category_id", event.target.value)}
            >
              <option value="">Uncategorised</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supplier">
            <select
              className="input"
              value={form.supplier_id}
              onChange={(event) => update("supplier_id", event.target.value)}
            >
              <option value="">No supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Unit price" hint="Selling price in USD">
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={form.unit_price}
              onChange={(event) => update("unit_price", event.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Cost price" hint="What you pay per unit">
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={form.cost_price}
              onChange={(event) => update("cost_price", event.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Quantity" hint={isEdit ? "Use movements page" : "Opening stock"}>
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              disabled={isEdit}
              value={form.quantity}
              onChange={(event) => update("quantity", event.target.value)}
            />
          </Field>
          <Field label="Reorder level">
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              value={form.reorder_level}
              onChange={(event) => update("reorder_level", event.target.value)}
            />
          </Field>
          <Field label="Location">
            <input
              className="input"
              value={form.location}
              onChange={(event) => update("location", event.target.value)}
              placeholder="A1-03"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
