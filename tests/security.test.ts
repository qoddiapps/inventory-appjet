import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

async function main() {
// Never touch the development or deployed inventory while running these tests.
const testDataDir = mkdtempSync(path.join(tmpdir(), "stockroom-security-"));
process.env.DATA_DIR = testDataDir;

const repo = await import("../lib/repo");
const { readJson } = await import("../lib/api");
const { csvCell } = await import("../app/api/export/route");
const movementsRoute = await import("../app/api/movements/route");
const productsRoute = await import("../app/api/products/route");
const nextConfig = (await import("../next.config")).default;

after(() => {
  rmSync(testDataDir, { recursive: true, force: true });
});

function validProduct(sku: string, quantity = 5) {
  return {
    sku,
    name: `Security test ${sku}`,
    description: "isolated test data",
    unit_price: 10,
    cost_price: 5,
    quantity,
    reorder_level: 1,
    location: "TEST",
  };
}

test("a rejected direct quantity update cannot bypass the stock ledger", () => {
  const product = repo.createProduct(validProduct("SEC-QUANTITY", 5));

  assert.throws(
    () => repo.updateProduct(product.id, { quantity: 999 }),
    repo.ValidationError,
  );
  assert.equal(repo.getProduct(product.id).quantity, 5);
  assert.equal(repo.listMovements({ productId: product.id }).length, 1);
});

test("deleting a receipt cannot leave negative stock", () => {
  const product = repo.createProduct(validProduct("SEC-DELETE", 10));
  repo.createMovement({ product_id: product.id, type: "out", quantity: 4 });
  assert.equal(repo.getProduct(product.id).quantity, 6);

  const receipt = repo.listMovements({ productId: product.id, type: "in" })[0];
  assert.throws(() => repo.deleteMovement(receipt.id), repo.ValidationError);
  assert.equal(repo.getProduct(product.id).quantity, 6);
  assert.ok(repo.listMovements({ productId: product.id }).some((row) => row.id === receipt.id));
});

test("CSV cells neutralize spreadsheet formulas without damaging ordinary data", () => {
  for (const formula of ["=1+1", "+CMD()", "-2+3", "@SUM(A1:A2)", "\t=1+1", "\r=1+1", "  =1+1"]) {
    const cell = csvCell(formula);
    assert.ok(cell.startsWith("'") || cell.startsWith("\"'"), `unsafe CSV cell: ${cell}`);
  }
  assert.equal(csvCell("Ordinary product"), "Ordinary product");
  assert.equal(csvCell('Quoted "name"'), '"Quoted ""name"""');
  assert.equal(csvCell(12.5), "12.5");
});

test("JSON writes require a JSON content type", async () => {
  const request = new Request("https://inventory.test/api/products", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(validProduct("SEC-MIME")),
  });
  await assert.rejects(readJson(request), (error: unknown) => {
    return typeof error === "object" && error !== null && "status" in error && error.status === 415;
  });
});

test("cross-site browser writes are rejected before parsing", async () => {
  const request = new Request("https://inventory.test/api/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.invalid",
      "Sec-Fetch-Site": "cross-site",
    },
    body: JSON.stringify(validProduct("SEC-ORIGIN")),
  });
  await assert.rejects(readJson(request), (error: unknown) => {
    return typeof error === "object" && error !== null && "status" in error && error.status === 403;
  });
});

test("same-origin JSON writes remain accepted", async () => {
  const request = new Request("https://inventory.test/api/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Origin: "https://inventory.test",
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify({ name: "Legitimate write" }),
  });
  assert.deepEqual(await readJson(request), { name: "Legitimate write" });
});

test("JSON request bodies are capped before unbounded parsing", async () => {
  const request = new Request("https://inventory.test/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: "x".repeat(70_000) }),
  });
  await assert.rejects(readJson(request), (error: unknown) => {
    return typeof error === "object" && error !== null && "status" in error && error.status === 413;
  });
});

test("malformed movement limits return 400 rather than reaching SQLite", async () => {
  const response = await movementsRoute.GET(
    new Request("https://inventory.test/api/movements?limit=not-a-number"),
  );
  assert.equal(response.status, 400);
});

test("malformed product filters and sorts return 400", async () => {
  for (const query of ["category_id=not-a-number", "supplier_id=0", "sort=sql-injection"]) {
    const response = await productsRoute.GET(
      new Request(`https://inventory.test/api/products?${query}`),
    );
    assert.equal(response.status, 400, query);
  }
});

test("persisted quantities and text have enforceable bounds", () => {
  assert.throws(
    () => repo.createProduct(validProduct("SEC-HUGE", 1_000_000_001)),
    repo.ValidationError,
  );
  assert.throws(() => repo.createCategory({ name: "x".repeat(129) }), repo.ValidationError);
});

test("browser security headers are configured for every route", async () => {
  assert.equal(nextConfig.poweredByHeader, false);
  assert.equal(typeof nextConfig.headers, "function");
  const rules = await nextConfig.headers!();
  const global = rules.find((rule) => rule.source === "/:path*");
  assert.ok(global, "missing global security header rule");
  const headers = Object.fromEntries(global.headers.map((header) => [header.key, header.value]));
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Referrer-Policy"], "no-referrer");
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.match(headers["Content-Security-Policy"], /object-src 'none'/);
});
