import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

async function main() {
  // Never touch the development or deployed inventory while running these tests.
  const testDataDir = mkdtempSync(path.join(tmpdir(), "stockroom-public-"));
  process.env.DATA_DIR = testDataDir;
  delete process.env.STOCKROOM_ADMIN_PASSWORD;
  delete process.env.STOCKROOM_SESSION_SECRET;

  const repo = await import("../lib/repo");
  const api = await import("../lib/api");
  const productsRoute = await import("../app/api/products/route");
  const categoriesRoute = await import("../app/api/categories/route");
  const statsRoute = await import("../app/api/stats/route");
  const exportRoute = await import("../app/api/export/route");

  after(() => rmSync(testDataDir, { recursive: true, force: true }));

  test("inventory reads work without a login session", () => {
    const products = repo.listProducts({ sort: "name" });
    assert.ok(products.length > 0, "seeded products should be readable");
    assert.ok(repo.listCategories().length > 0, "categories should be readable");
    assert.ok(repo.listSuppliers().length > 0, "suppliers should be readable");
    assert.ok(repo.listMovements({ limit: 5 }).length > 0, "movements should be readable");

    const stats = repo.getStats();
    assert.ok(stats.product_count > 0, "dashboard stats should be readable");
  });

  test("public API routes respond without credentials", async () => {
    const productsResponse = await productsRoute.GET(
      new Request("http://localhost/api/products"),
    );
    assert.equal(productsResponse.status, 200);
    const products = (await productsResponse.json()) as Array<{ sku: string }>;
    assert.ok(products.length > 0);

    const statsResponse = await statsRoute.GET(new Request("http://localhost/api/stats"));
    assert.equal(statsResponse.status, 200);

    const exportResponse = await exportRoute.GET(new Request("http://localhost/api/export"));
    assert.equal(exportResponse.status, 200);
    assert.match(exportResponse.headers.get("content-type") ?? "", /text\/csv/);
    const csv = await exportResponse.text();
    assert.match(csv, /^sku,name,/);
    assert.match(csv, /ELC-1001/);
  });

  test("public writes still require a same-origin JSON request", async () => {
    const textBody = new Request("http://localhost/api/products", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    await assert.rejects(
      () => api.readJson(textBody),
      (error: unknown) => error instanceof api.HttpError && error.status === 415,
    );

    const crossSite = new Request("http://localhost/api/products", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    assert.throws(
      () => api.assertSameOrigin(crossSite),
      (error: unknown) => error instanceof api.HttpError && error.status === 403,
    );

    const valid = new Request("http://localhost/api/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ demo: true }),
    });
    assert.deepEqual(await api.readJson(valid), { demo: true });
  });

  test("public create endpoints work and persist records", async () => {
    const categoryResponse = await categoriesRoute.POST(
      new Request("http://localhost/api/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Regression Category", description: "test category" }),
      }),
    );
    assert.equal(categoryResponse.status, 201);
    const category = (await categoryResponse.json()) as { id: number };

    const productResponse = await productsRoute.POST(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: "PUBLIC-ROUTE-1",
          name: "Route Product",
          category_id: category.id,
          unit_price: 9.99,
          cost_price: 4.5,
          quantity: 2,
          reorder_level: 1,
        }),
      }),
    );
    assert.equal(productResponse.status, 201);
    const created = (await productResponse.json()) as { id: number; quantity: number };
    assert.equal(created.quantity, 2);
    assert.equal(repo.getProduct(created.id).sku, "PUBLIC-ROUTE-1");
  });

  test("stock changes remain ledger-controlled without auth", () => {
    const product = repo.createProduct({
      sku: "PUBLIC-LEDGER-1",
      name: "Ledger Regression Product",
      unit_price: 12.5,
      cost_price: 5,
      quantity: 3,
      reorder_level: 1,
    });

    assert.throws(
      () => repo.updateProduct(product.id, { quantity: 99 }),
      (error: unknown) =>
        error instanceof repo.ValidationError && /Use a stock movement/.test(error.message),
    );

    const movement = repo.createMovement({
      product_id: product.id,
      type: "out",
      quantity: 2,
      reason: "regression test",
    });
    assert.equal(movement.delta, -2);
    assert.equal(repo.getProduct(product.id).quantity, 1);

    assert.throws(
      () => repo.deleteProduct(product.id),
      (error: unknown) => error instanceof repo.ConflictError,
    );

    repo.deleteMovement(movement.id);
    assert.equal(repo.getProduct(product.id).quantity, 3);
  });

  test("CSV export neutralizes spreadsheet formulas", () => {
    assert.equal(exportRoute.csvCell("=1+1"), "'=1+1");
    assert.equal(exportRoute.csvCell("normal value"), "normal value");
    assert.equal(exportRoute.csvCell('a,b'), '"a,b"');
  });

  test("login pages, auth routes and auth modules are removed", () => {
    for (const removed of [
      "app/login",
      "app/api/auth",
      "lib/auth.ts",
      "lib/page-auth.ts",
      "lib/logout.ts",
      "lib/login-rate-limit.ts",
    ]) {
      assert.equal(
        existsSync(path.join(process.cwd(), removed)),
        false,
        `${removed} should be removed from the public demo`,
      );
    }
  });
}

main();
