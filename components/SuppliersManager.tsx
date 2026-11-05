"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Supplier } from "@/lib/types";
import { Alert, EmptyState, Field, Modal } from "./ui";

const EMPTY = { name: "", contact_name: "", email: "", phone: "", lead_time_days: "7" };

export function SuppliersManager({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter((supplier) =>
      `${supplier.name} ${supplier.contact_name ?? ""} ${supplier.email ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [suppliers, search]);

  function update(field: keyof typeof EMPTY, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contact_name: supplier.contact_name ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      lead_time_days: String(supplier.lead_time_days),
    });
    setError(null);
    setFormOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/suppliers/${editing.id}` : "/api/suppliers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.issues?.join(", ") ?? payload.error ?? "Could not save supplier");
      }
      setFormOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save supplier");
    } finally {
      setSaving(false);
    }
  }

  async function remove(supplier: Supplier) {
    if (!confirm(`Delete supplier "${supplier.name}"? Products stay but lose this supplier.`)) return;
    setDeletingId(supplier.id);
    setError(null);
    try {
      const response = await fetch(`/api/suppliers/${supplier.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Could not delete supplier");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete supplier");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <input
          className="input max-w-xs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search suppliers…"
          aria-label="Search suppliers"
        />
        <button type="button" className="btn-primary" onClick={openCreate}>
          + New supplier
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
            title={suppliers.length === 0 ? "No suppliers yet" : "No suppliers match your search"}
            description={
              suppliers.length === 0
                ? "Add vendors so products can be linked to a source."
                : "Try a different name, contact or email."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="border-b border-white/8 bg-white/[0.02]">
                <tr>
                  <th className="th">Supplier</th>
                  <th className="th">Contact</th>
                  <th className="th">Phone</th>
                  <th className="th">Lead time</th>
                  <th className="th">Products</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((supplier) => (
                  <tr key={supplier.id} className="transition-colors hover:bg-white/[0.025]">
                    <td className="td font-medium text-white">{supplier.name}</td>
                    <td className="td">
                      <div>{supplier.contact_name ?? "—"}</div>
                      {supplier.email ? <div className="text-xs text-slate-500">{supplier.email}</div> : null}
                    </td>
                    <td className="td text-slate-400">{supplier.phone ?? "—"}</td>
                    <td className="td tabular-nums">{supplier.lead_time_days} days</td>
                    <td className="td tabular-nums">{supplier.product_count ?? 0}</td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn-ghost px-2.5 py-1.5 text-xs"
                          onClick={() => openEdit(supplier)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-danger px-2.5 py-1.5 text-xs"
                          onClick={() => remove(supplier)}
                          disabled={deletingId === supplier.id}
                        >
                          {deletingId === supplier.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit supplier" : "New supplier"}
        description="Vendors you buy stock from."
      >
        <form onSubmit={submit} className="space-y-3.5">
          {error ? <Alert>{error}</Alert> : null}
          <Field label="Supplier name">
            <input
              className="input"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Northwind Traders"
              required
              minLength={2}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contact person">
              <input
                className="input"
                value={form.contact_name}
                onChange={(event) => update("contact_name", event.target.value)}
                placeholder="Ana Silva"
              />
            </Field>
            <Field label="Phone">
              <input
                className="input"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="+1 555 0142"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email">
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder="ana@northwind.example"
              />
            </Field>
            <Field label="Lead time (days)">
              <input
                className="input"
                type="number"
                min={0}
                step={1}
                value={form.lead_time_days}
                onChange={(event) => update("lead_time_days", event.target.value)}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create supplier"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
