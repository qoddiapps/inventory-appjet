"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { Alert, EmptyState, Field, Modal } from "./ui";

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setError(null);
    setFormOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setName(category.name);
    setDescription(category.description ?? "");
    setError(null);
    setFormOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/categories/${editing.id}` : "/api/categories", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.issues?.join(", ") ?? payload.error ?? "Could not save category");
      }
      setFormOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save category");
    } finally {
      setSaving(false);
    }
  }

  async function remove(category: Category) {
    if (!confirm(`Delete category "${category.name}"? Products keep existing but lose this category.`)) {
      return;
    }
    setDeletingId(category.id);
    setError(null);
    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Could not delete category");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete category");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">
          {categories.length} {categories.length === 1 ? "category" : "categories"} grouping your catalogue.
        </p>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + New category
        </button>
      </div>

      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="card overflow-hidden">
        {categories.length === 0 ? (
          <EmptyState
            title="No categories yet"
            description="Create a category to start grouping products."
            action={
              <button type="button" className="btn-primary" onClick={openCreate}>
                New category
              </button>
            }
          />
        ) : (
          <>
            <div className="hidden border-b border-white/8 bg-white/[0.02] sm:grid sm:grid-cols-[1.4fr_2fr_1fr_0.9fr_auto]">
              <div className="th">Name</div>
              <div className="th">Description</div>
              <div className="th">Products</div>
              <div className="th">Created</div>
              <div className="th text-right">Actions</div>
            </div>
            <ul className="divide-y divide-white/5">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[1.4fr_2fr_1fr_0.9fr_auto] sm:items-center sm:gap-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{category.name}</div>
                    <div className="text-xs text-slate-500 sm:hidden">{shortDate(category.created_at)}</div>
                  </div>
                  <div className="text-sm text-slate-400">
                    {category.description ?? <span className="text-slate-600">—</span>}
                  </div>
                  <div className="text-sm tabular-nums text-slate-300">{category.product_count ?? 0}</div>
                  <div className="hidden text-sm text-slate-400 sm:block">{shortDate(category.created_at)}</div>
                  <div className="flex items-center gap-1.5 sm:justify-end">
                    <button type="button" className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => openEdit(category)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-2.5 py-1.5 text-xs"
                      onClick={() => remove(category)}
                      disabled={deletingId === category.id}
                    >
                      {deletingId === category.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit category" : "New category"}
        description={editing ? "Update this category's name or description." : "Group similar products together."}
      >
        <form onSubmit={submit} className="space-y-3.5">
          {error ? <Alert>{error}</Alert> : null}
          <Field label="Name">
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Electronics"
              required
              minLength={2}
            />
          </Field>
          <Field label="Description" hint="Optional — short summary of what belongs here.">
            <textarea
              className="input min-h-20"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Devices, accessories and components"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create category"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
