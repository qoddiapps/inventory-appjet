import { listProducts } from "@/lib/repo";

export const dynamic = "force-dynamic";

export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  // Prevent user-controlled text from becoming a formula when opened in a spreadsheet.
  if (typeof value === "string" && /^(?:[=+\-@\t\r\n]|\s+[=+\-@])/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET() {
  const products = listProducts({ sort: "name" });
  const header = [
    "sku",
    "name",
    "category",
    "supplier",
    "quantity",
    "reorder_level",
    "unit_price",
    "cost_price",
    "stock_value",
    "location",
  ];
  const rows = products.map((product) => [
    product.sku,
    product.name,
    product.category_name,
    product.supplier_name,
    product.quantity,
    product.reorder_level,
    product.unit_price.toFixed(2),
    product.cost_price.toFixed(2),
    (product.unit_price * product.quantity).toFixed(2),
    product.location,
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${stamp}.csv"`,
    },
  });
}
