import { getDb, nowIso } from "./db";
import type {
  Category,
  MovementType,
  Product,
  Stats,
  StockMovement,
  Supplier,
} from "./types";

export class ValidationError extends Error {
  issues: string[];
  constructor(issues: string[]) {
    super(issues.join("; "));
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

interface ProductRow {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category_id: number | null;
  supplier_id: number | null;
  category_name: string | null;
  supplier_name: string | null;
  unit_price_cents: number;
  cost_cents: number;
  quantity: number;
  reorder_level: number;
  location: string | null;
  created_at: string;
  updated_at: string;
}

const PRODUCT_SELECT = `
  SELECT p.id, p.sku, p.name, p.description, p.category_id, p.supplier_id,
         c.name AS category_name, s.name AS supplier_name,
         p.unit_price_cents, p.cost_cents, p.quantity, p.reorder_level,
         p.location, p.created_at, p.updated_at
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
`;

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category_id: row.category_id,
    supplier_id: row.supplier_id,
    category_name: row.category_name,
    supplier_name: row.supplier_name,
    unit_price: row.unit_price_cents / 100,
    cost_price: row.cost_cents / 100,
    quantity: row.quantity,
    reorder_level: row.reorder_level,
    location: row.location,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalStr(value: unknown): string | null {
  const text = str(value);
  return text.length > 0 ? text : null;
}

function money(value: unknown, field: string, issues: string[]): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) {
    issues.push(`${field} must be a non-negative number`);
    return 0;
  }
  if (num > 10_000_000) {
    issues.push(`${field} is unrealistically large`);
  }
  return Math.round(num * 100) / 100;
}

function wholeNumber(value: unknown, field: string, issues: string[], fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(num) || num < 0) {
    issues.push(`${field} must be a whole number of 0 or more`);
    return fallback;
  }
  return num;
}

function idOrNull(value: unknown, field: string, issues: string[]): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    issues.push(`${field} must be a valid id`);
    return null;
  }
  return num;
}

/* ------------------------------------------------------------------ products */

export interface ProductInput {
  sku?: unknown;
  name?: unknown;
  description?: unknown;
  category_id?: unknown;
  supplier_id?: unknown;
  unit_price?: unknown;
  cost_price?: unknown;
  quantity?: unknown;
  reorder_level?: unknown;
  location?: unknown;
}

export interface ProductFilter {
  search?: string;
  categoryId?: number | null;
  supplierId?: number | null;
  lowStock?: boolean;
  sort?: "name" | "quantity" | "value" | "updated";
}

export function listProducts(filter: ProductFilter = {}): Product[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.search) {
    where.push("(p.name LIKE @search OR p.sku LIKE @search OR p.description LIKE @search)");
    params.search = `%${filter.search}%`;
  }
  if (filter.categoryId) {
    where.push("p.category_id = @categoryId");
    params.categoryId = filter.categoryId;
  }
  if (filter.supplierId) {
    where.push("p.supplier_id = @supplierId");
    params.supplierId = filter.supplierId;
  }
  if (filter.lowStock) {
    where.push("p.quantity <= p.reorder_level");
  }

  const orderBy =
    filter.sort === "quantity"
      ? "p.quantity ASC, p.name ASC"
      : filter.sort === "value"
        ? "p.unit_price_cents * p.quantity DESC, p.name ASC"
        : filter.sort === "updated"
          ? "p.updated_at DESC"
          : "p.name ASC";

  const sql = `${PRODUCT_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${orderBy}`;
  return (getDb().prepare(sql).all(params) as ProductRow[]).map(mapProduct);
}

export function getProduct(id: number): Product {
  const row = getDb()
    .prepare(`${PRODUCT_SELECT} WHERE p.id = ?`)
    .get(id) as ProductRow | undefined;
  if (!row) throw new NotFoundError("Product not found");
  return mapProduct(row);
}

function validateProduct(input: ProductInput, partial: boolean) {
  const issues: string[] = [];
  const values: Record<string, unknown> = {};

  if (!partial || input.sku !== undefined) {
    const sku = str(input.sku).toUpperCase();
    if (sku.length < 2) issues.push("SKU must be at least 2 characters");
    values.sku = sku;
  }
  if (!partial || input.name !== undefined) {
    const name = str(input.name);
    if (name.length < 2) issues.push("Name must be at least 2 characters");
    values.name = name;
  }
  if (!partial || input.unit_price !== undefined) {
    values.unit_price_cents = Math.round(money(input.unit_price, "Unit price", issues) * 100);
  }
  if (!partial || input.cost_price !== undefined) {
    values.cost_cents = Math.round(money(input.cost_price, "Cost price", issues) * 100);
  }
  if (!partial || input.reorder_level !== undefined) {
    values.reorder_level = wholeNumber(input.reorder_level, "Reorder level", issues);
  }
  if (!partial || input.quantity !== undefined) {
    values.quantity = wholeNumber(input.quantity, "Quantity", issues);
  }
  if (input.description !== undefined) values.description = optionalStr(input.description);
  if (input.location !== undefined) values.location = optionalStr(input.location);
  if (input.category_id !== undefined) {
    values.category_id = idOrNull(input.category_id, "Category", issues);
  }
  if (input.supplier_id !== undefined) {
    values.supplier_id = idOrNull(input.supplier_id, "Supplier", issues);
  }

  if (issues.length > 0) throw new ValidationError(issues);
  return values;
}

function ensureSkuAvailable(sku: string, excludeId?: number) {
  const row = getDb()
    .prepare("SELECT id FROM products WHERE sku = ? AND id IS NOT ?")
    .get(sku, excludeId ?? null) as { id: number } | undefined;
  if (row) throw new ValidationError([`SKU ${sku} is already in use`]);
}

export function createProduct(input: ProductInput): Product {
  const values = validateProduct(input, false) as {
    sku: string;
    name: string;
    description: string | null;
    location: string | null;
    category_id: number | null;
    supplier_id: number | null;
    unit_price_cents: number;
    cost_cents: number;
    quantity: number;
    reorder_level: number;
  };
  ensureSkuAvailable(values.sku);

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO products
        (sku, name, description, category_id, supplier_id, unit_price_cents, cost_cents,
         quantity, reorder_level, location, created_at, updated_at)
       VALUES (@sku, @name, @description, @category_id, @supplier_id, @unit_price_cents, @cost_cents,
               @quantity, @reorder_level, @location, @created, @created)`,
    )
    .run({ ...values, created: nowIso() });

  const id = Number(info.lastInsertRowid);
  if (values.quantity > 0) {
    db.prepare(
      `INSERT INTO stock_movements (product_id, type, quantity, delta, reason, reference, created_at)
       VALUES (?, 'in', ?, ?, 'Initial stock', 'OPENING-BALANCE', ?)`,
    ).run(id, values.quantity, values.quantity, nowIso());
  }
  return getProduct(id);
}

export function updateProduct(id: number, input: ProductInput): Product {
  const existing = getProduct(id);
  const values = validateProduct(input, true) as Record<string, unknown>;
  if (typeof values.sku === "string") ensureSkuAvailable(values.sku, id);

  const fields = Object.keys(values);
  if (fields.length > 0) {
    const assignments = fields.map((field) => `${field} = @${field}`).join(", ");
    getDb()
      .prepare(`UPDATE products SET ${assignments}, updated_at = @updated WHERE id = @id`)
      .run({ ...values, updated: nowIso(), id });
  }

  // Quantity edits are rejected here on purpose: stock only changes through movements.
  if (values.quantity !== undefined && values.quantity !== existing.quantity) {
    throw new ValidationError(["Use a stock movement to change quantity"]);
  }
  return getProduct(id);
}

export function deleteProduct(id: number): void {
  const info = getDb().prepare("DELETE FROM products WHERE id = ?").run(id);
  if (info.changes === 0) throw new NotFoundError("Product not found");
}

/* ---------------------------------------------------------------- categories */

export function listCategories(): Category[] {
  return getDb()
    .prepare(
      `SELECT c.id, c.name, c.description, c.created_at,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
       FROM categories c ORDER BY c.name ASC`,
    )
    .all() as Category[];
}

export function createCategory(input: { name?: unknown; description?: unknown }): Category {
  const name = str(input.name);
  if (name.length < 2) throw new ValidationError(["Category name must be at least 2 characters"]);
  try {
    const info = getDb()
      .prepare("INSERT INTO categories (name, description, created_at) VALUES (?, ?, ?)")
      .run(name, optionalStr(input.description), nowIso());
    return getDb()
      .prepare("SELECT id, name, description, created_at FROM categories WHERE id = ?")
      .get(Number(info.lastInsertRowid)) as Category;
  } catch {
    throw new ValidationError([`Category "${name}" already exists`]);
  }
}

export function updateCategory(id: number, input: { name?: unknown; description?: unknown }): Category {
  const name = str(input.name);
  if (name.length < 2) throw new ValidationError(["Category name must be at least 2 characters"]);
  try {
    const info = getDb()
      .prepare("UPDATE categories SET name = ?, description = ? WHERE id = ?")
      .run(name, optionalStr(input.description), id);
    if (info.changes === 0) throw new NotFoundError("Category not found");
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    throw new ValidationError([`Category "${name}" already exists`]);
  }
  return getDb()
    .prepare("SELECT id, name, description, created_at FROM categories WHERE id = ?")
    .get(id) as Category;
}

export function deleteCategory(id: number): void {
  const info = getDb().prepare("DELETE FROM categories WHERE id = ?").run(id);
  if (info.changes === 0) throw new NotFoundError("Category not found");
}

/* ----------------------------------------------------------------- suppliers */

export function listSuppliers(): Supplier[] {
  return getDb()
    .prepare(
      `SELECT s.id, s.name, s.contact_name, s.email, s.phone, s.lead_time_days, s.created_at,
              (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id) AS product_count
       FROM suppliers s ORDER BY s.name ASC`,
    )
    .all() as Supplier[];
}

export interface SupplierInput {
  name?: unknown;
  contact_name?: unknown;
  email?: unknown;
  phone?: unknown;
  lead_time_days?: unknown;
}

function validateSupplier(input: SupplierInput) {
  const issues: string[] = [];
  const name = str(input.name);
  if (name.length < 2) issues.push("Supplier name must be at least 2 characters");

  const email = optionalStr(input.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push("Email address looks invalid");
  }

  const lead = input.lead_time_days === undefined || input.lead_time_days === ""
    ? 7
    : wholeNumber(input.lead_time_days, "Lead time", issues, 7);

  if (issues.length > 0) throw new ValidationError(issues);
  return {
    name,
    contact_name: optionalStr(input.contact_name),
    email,
    phone: optionalStr(input.phone),
    lead_time_days: lead,
  };
}

export function createSupplier(input: SupplierInput): Supplier {
  const values = validateSupplier(input);
  try {
    const info = getDb()
      .prepare(
        `INSERT INTO suppliers (name, contact_name, email, phone, lead_time_days, created_at)
         VALUES (@name, @contact_name, @email, @phone, @lead_time_days, @created)`,
      )
      .run({ ...values, created: nowIso() });
    return getDb()
      .prepare("SELECT * FROM suppliers WHERE id = ?")
      .get(Number(info.lastInsertRowid)) as Supplier;
  } catch {
    throw new ValidationError([`Supplier "${values.name}" already exists`]);
  }
}

export function updateSupplier(id: number, input: SupplierInput): Supplier {
  const values = validateSupplier(input);
  try {
    const info = getDb()
      .prepare(
        `UPDATE suppliers SET name = @name, contact_name = @contact_name, email = @email,
         phone = @phone, lead_time_days = @lead_time_days WHERE id = @id`,
      )
      .run({ ...values, id });
    if (info.changes === 0) throw new NotFoundError("Supplier not found");
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    throw new ValidationError([`Supplier "${values.name}" already exists`]);
  }
  return getDb().prepare("SELECT * FROM suppliers WHERE id = ?").get(id) as Supplier;
}

export function deleteSupplier(id: number): void {
  const info = getDb().prepare("DELETE FROM suppliers WHERE id = ?").run(id);
  if (info.changes === 0) throw new NotFoundError("Supplier not found");
}

/* ----------------------------------------------------------------- movements */

export interface MovementInput {
  product_id?: unknown;
  type?: unknown;
  quantity?: unknown;
  reason?: unknown;
  reference?: unknown;
}

const MOVEMENT_TYPES: MovementType[] = ["in", "out", "adjust"];

export function listMovements(options: {
  productId?: number;
  type?: string;
  limit?: number;
} = {}): StockMovement[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (options.productId) {
    where.push("m.product_id = @productId");
    params.productId = options.productId;
  }
  if (options.type && MOVEMENT_TYPES.includes(options.type as MovementType)) {
    where.push("m.type = @type");
    params.type = options.type;
  }
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);

  return getDb()
    .prepare(
      `SELECT m.id, m.product_id, m.type, m.quantity, m.delta, m.reason, m.reference, m.created_at,
              p.name AS product_name, p.sku AS product_sku
       FROM stock_movements m JOIN products p ON p.id = m.product_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY m.created_at DESC, m.id DESC LIMIT ${limit}`,
    )
    .all(params) as StockMovement[];
}

export function createMovement(input: MovementInput): StockMovement {
  const issues: string[] = [];
  const productId = Number(input.product_id);
  if (!Number.isInteger(productId) || productId <= 0) issues.push("A product is required");

  const type = String(input.type ?? "") as MovementType;
  if (!MOVEMENT_TYPES.includes(type)) issues.push("Type must be in, out or adjust");

  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    issues.push("Quantity must be a whole number greater than 0");
  }

  if (issues.length > 0) throw new ValidationError(issues);

  const product = getProduct(productId);
  const delta = type === "in" ? quantity : type === "out" ? -quantity : quantity - product.quantity;
  const nextQuantity = product.quantity + delta;

  if (nextQuantity < 0) {
    throw new ValidationError([
      `Only ${product.quantity} unit(s) of ${product.name} in stock — cannot remove ${quantity}`,
    ]);
  }

  const db = getDb();
  const createdAt = nowIso();
  let movementId = 0;

  db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO stock_movements (product_id, type, quantity, delta, reason, reference, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        productId,
        type,
        type === "adjust" ? Math.abs(delta) : quantity,
        delta,
        optionalStr(input.reason),
        optionalStr(input.reference),
        createdAt,
      );
    movementId = Number(info.lastInsertRowid);
    db.prepare("UPDATE products SET quantity = ?, updated_at = ? WHERE id = ?").run(
      nextQuantity,
      createdAt,
      productId,
    );
  })();

  return db
    .prepare(
      `SELECT m.id, m.product_id, m.type, m.quantity, m.delta, m.reason, m.reference, m.created_at,
              p.name AS product_name, p.sku AS product_sku
       FROM stock_movements m JOIN products p ON p.id = m.product_id WHERE m.id = ?`,
    )
    .get(movementId) as StockMovement;
}

export function deleteMovement(id: number): void {
  const db = getDb();
  db.transaction(() => {
    const movement = db
      .prepare("SELECT id, product_id, delta FROM stock_movements WHERE id = ?")
      .get(id) as { id: number; product_id: number; delta: number } | undefined;
    if (!movement) throw new NotFoundError("Movement not found");

    db.prepare("DELETE FROM stock_movements WHERE id = ?").run(id);
    db.prepare("UPDATE products SET quantity = quantity - ?, updated_at = ? WHERE id = ?").run(
      movement.delta,
      nowIso(),
      movement.product_id,
    );
  })();
}

/* --------------------------------------------------------------------- stats */

export function getStats(): Stats {
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS product_count,
              COALESCE(SUM(quantity), 0) AS total_units,
              COALESCE(SUM(cost_cents * quantity), 0) AS inventory_cost_cents,
              COALESCE(SUM(unit_price_cents * quantity), 0) AS inventory_retail_cents,
              COALESCE(SUM(CASE WHEN quantity <= reorder_level THEN 1 ELSE 0 END), 0) AS low_stock_count,
              COALESCE(SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END), 0) AS out_of_stock_count
       FROM products`,
    )
    .get() as {
    product_count: number;
    total_units: number;
    inventory_cost_cents: number;
    inventory_retail_cents: number;
    low_stock_count: number;
    out_of_stock_count: number;
  };

  const counts = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM categories) AS category_count,
              (SELECT COUNT(*) FROM suppliers) AS supplier_count`,
    )
    .get() as { category_count: number; supplier_count: number };

  const lowStock = listProducts({ lowStock: true, sort: "quantity" }).slice(0, 8);

  const category_breakdown = db
    .prepare(
      `SELECT COALESCE(c.name, 'Uncategorised') AS name,
              COALESCE(SUM(p.quantity), 0) AS units,
              COALESCE(SUM(p.unit_price_cents * p.quantity), 0) AS value_cents
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       GROUP BY COALESCE(c.name, 'Uncategorised')
       ORDER BY value_cents DESC`,
    )
    .all() as { name: string; units: number; value_cents: number }[];

  return {
    product_count: totals.product_count,
    total_units: totals.total_units,
    inventory_cost: totals.inventory_cost_cents / 100,
    inventory_retail: totals.inventory_retail_cents / 100,
    low_stock_count: totals.low_stock_count,
    out_of_stock_count: totals.out_of_stock_count,
    category_count: counts.category_count,
    supplier_count: counts.supplier_count,
    low_stock: lowStock,
    recent_movements: listMovements({ limit: 6 }),
    category_breakdown: category_breakdown.map((row) => ({
      name: row.name,
      units: row.units,
      value: row.value_cents / 100,
    })),
  };
}
