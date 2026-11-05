import type Database from "better-sqlite3";

interface SeedCategory {
  name: string;
  description: string;
}

const CATEGORIES: SeedCategory[] = [
  { name: "Electronics", description: "Devices, accessories and components" },
  { name: "Office Supplies", description: "Everyday consumables for the workspace" },
  { name: "Furniture", description: "Desks, chairs and storage" },
  { name: "Packaging", description: "Boxes, tape and shipping materials" },
  { name: "Tools", description: "Hand tools and workshop equipment" },
];

const SUPPLIERS = [
  { name: "Northwind Traders", contact: "Ana Silva", email: "ana@northwind.example", phone: "+1 555 0142", lead: 5 },
  { name: "Contoso Components", contact: "Ben Okafor", email: "ben@contoso.example", phone: "+1 555 0187", lead: 10 },
  { name: "Fabrikam Wholesale", contact: "Chloe Dubois", email: "chloe@fabrikam.example", phone: "+1 555 0111", lead: 3 },
  { name: "Adatum Logistics", contact: "Diego Ramos", email: "diego@adatum.example", phone: "+1 555 0163", lead: 14 },
];

interface SeedProduct {
  sku: string;
  name: string;
  description: string;
  category: string;
  supplier: string;
  unitPrice: number;
  cost: number;
  qty: number;
  reorder: number;
  location: string;
}

const PRODUCTS: SeedProduct[] = [
  { sku: "ELC-1001", name: "USB-C Cable 2m", description: "Braided 100W USB-C to USB-C cable", category: "Electronics", supplier: "Contoso Components", unitPrice: 19.99, cost: 6.4, qty: 240, reorder: 50, location: "A1-03" },
  { sku: "ELC-1002", name: '4K Monitor 27"', description: "27-inch IPS 4K display with USB-C hub", category: "Electronics", supplier: "Northwind Traders", unitPrice: 429.0, cost: 288.5, qty: 18, reorder: 10, location: "A2-01" },
  { sku: "ELC-1003", name: "Wireless Keyboard", description: "Low-profile Bluetooth keyboard", category: "Electronics", supplier: "Contoso Components", unitPrice: 69.5, cost: 31.2, qty: 74, reorder: 25, location: "A1-07" },
  { sku: "ELC-1004", name: "Laptop Stand", description: "Adjustable aluminium laptop riser", category: "Electronics", supplier: "Fabrikam Wholesale", unitPrice: 39.0, cost: 14.75, qty: 6, reorder: 20, location: "A1-09" },
  { sku: "ELC-1005", name: "Noise-Cancelling Headphones", description: "Over-ear ANC headphones, 30h battery", category: "Electronics", supplier: "Northwind Traders", unitPrice: 249.0, cost: 158.0, qty: 0, reorder: 8, location: "A3-02" },
  { sku: "OFF-2001", name: "A4 Copy Paper (500 sheets)", description: "80gsm recycled white paper", category: "Office Supplies", supplier: "Fabrikam Wholesale", unitPrice: 6.25, cost: 3.1, qty: 480, reorder: 120, location: "B1-01" },
  { sku: "OFF-2002", name: "Gel Pens (12 pack)", description: "0.5mm black gel rollerball pens", category: "Office Supplies", supplier: "Fabrikam Wholesale", unitPrice: 9.99, cost: 4.2, qty: 96, reorder: 40, location: "B1-04" },
  { sku: "OFF-2003", name: "Sticky Notes 76x76", description: "Assorted colour sticky notes, 5 pads", category: "Office Supplies", supplier: "Adatum Logistics", unitPrice: 5.5, cost: 2.05, qty: 34, reorder: 60, location: "B1-06" },
  { sku: "OFF-2004", name: "Whiteboard Markers", description: "Low-odour dry erase markers, 4 pack", category: "Office Supplies", supplier: "Adatum Logistics", unitPrice: 7.2, cost: 2.9, qty: 12, reorder: 30, location: "B2-02" },
  { sku: "FUR-3001", name: "Ergonomic Task Chair", description: "Mesh back chair with lumbar support", category: "Furniture", supplier: "Northwind Traders", unitPrice: 389.0, cost: 244.0, qty: 14, reorder: 5, location: "C1-01" },
  { sku: "FUR-3002", name: "Standing Desk 140cm", description: "Electric height-adjustable desk", category: "Furniture", supplier: "Northwind Traders", unitPrice: 649.0, cost: 430.0, qty: 7, reorder: 4, location: "C1-04" },
  { sku: "FUR-3003", name: "Filing Cabinet", description: "3-drawer steel filing cabinet", category: "Furniture", supplier: "Adatum Logistics", unitPrice: 219.0, cost: 132.5, qty: 21, reorder: 6, location: "C2-02" },
  { sku: "PKG-4001", name: "Shipping Box (medium)", description: "Double-wall corrugated 400x300x200mm", category: "Packaging", supplier: "Adatum Logistics", unitPrice: 2.4, cost: 0.95, qty: 900, reorder: 200, location: "D1-01" },
  { sku: "PKG-4002", name: "Packing Tape 50m", description: "Heavy-duty clear packing tape", category: "Packaging", supplier: "Adatum Logistics", unitPrice: 3.6, cost: 1.15, qty: 165, reorder: 80, location: "D1-05" },
  { sku: "PKG-4003", name: "Bubble Wrap Roll", description: "500mm x 100m protective wrap", category: "Packaging", supplier: "Fabrikam Wholesale", unitPrice: 24.0, cost: 11.4, qty: 3, reorder: 15, location: "D2-01" },
  { sku: "TL-5001", name: "Cordless Drill", description: "18V brushless drill with 2 batteries", category: "Tools", supplier: "Contoso Components", unitPrice: 179.0, cost: 108.0, qty: 9, reorder: 5, location: "E1-02" },
  { sku: "TL-5002", name: "Precision Screwdriver Set", description: "32-piece magnetic bit set", category: "Tools", supplier: "Contoso Components", unitPrice: 27.5, cost: 9.8, qty: 46, reorder: 20, location: "E1-05" },
  { sku: "TL-5003", name: "Tape Measure 5m", description: "Locking tape measure with belt clip", category: "Tools", supplier: "Fabrikam Wholesale", unitPrice: 11.9, cost: 4.3, qty: 58, reorder: 25, location: "E2-03" },
];

/** Populates the database once so the demo has meaningful data on first run. */
export function seedIfEmpty(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) AS c FROM products").get() as { c: number };
  if (count.c > 0) return;

  const insertCategory = db.prepare("INSERT INTO categories (name, description) VALUES (?, ?)");
  const insertSupplier = db.prepare(
    "INSERT INTO suppliers (name, contact_name, email, phone, lead_time_days) VALUES (?, ?, ?, ?, ?)",
  );
  const insertProduct = db.prepare(
    `INSERT INTO products
      (sku, name, description, category_id, supplier_id, unit_price_cents, cost_cents, quantity, reorder_level, location, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  );
  const insertMovement = db.prepare(
    "INSERT INTO stock_movements (product_id, type, quantity, delta, reason, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  db.transaction(() => {
    const categoryIds = new Map<string, number>();
    for (const category of CATEGORIES) {
      const info = insertCategory.run(category.name, category.description);
      categoryIds.set(category.name, Number(info.lastInsertRowid));
    }

    const supplierIds = new Map<string, number>();
    for (const supplier of SUPPLIERS) {
      const info = insertSupplier.run(supplier.name, supplier.contact, supplier.email, supplier.phone, supplier.lead);
      supplierIds.set(supplier.name, Number(info.lastInsertRowid));
    }

    const reasonsIn = ["Purchase order received", "Restock delivery", "Return to stock"];
    const reasonsOut = ["Customer order", "Internal use", "Damaged goods"];

    PRODUCTS.forEach((product, index) => {
      const info = insertProduct.run(
        product.sku,
        product.name,
        product.description,
        categoryIds.get(product.category) ?? null,
        supplierIds.get(product.supplier) ?? null,
        Math.round(product.unitPrice * 100),
        Math.round(product.cost * 100),
        product.qty,
        product.reorder,
        product.location,
      );
      const productId = Number(info.lastInsertRowid);

      // A moving stock history is created by replaying deltas that end at the seeded quantity.
      const received = Math.max(product.qty, Math.round(product.reorder * 1.5));
      const shipped = received - product.qty;
      const daysAgo = 10 + (index % 6);

      insertMovement.run(
        productId,
        "in",
        received,
        received,
        reasonsIn[index % reasonsIn.length],
        `PO-${1200 + index}`,
        `datetime('now', '-${daysAgo} days')`.replace(/^datetime\('now', '|'\)$/g, ""),
      );

      if (shipped > 0) {
        insertMovement.run(
          productId,
          "out",
          shipped,
          -shipped,
          reasonsOut[index % reasonsOut.length],
          `SO-${4300 + index}`,
          `datetime('now', '-${Math.max(1, daysAgo - 4)} days')`.replace(/^datetime\('now', '|'\)$/g, ""),
        );
      }
    });
  })();
}
