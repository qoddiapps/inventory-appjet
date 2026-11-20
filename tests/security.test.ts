import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

async function main() {
// Never touch the development or deployed inventory while running these tests.
const testDataDir = mkdtempSync(path.join(tmpdir(), "stockroom-security-"));
process.env.DATA_DIR = testDataDir;
process.env.STOCKROOM_ADMIN_PASSWORD = "test-admin-password-1234";
process.env.STOCKROOM_SESSION_SECRET = "test-session-secret-0123456789abcdef";

const repo = await import("../lib/repo");
const { readJson } = await import("../lib/api");
const { createSessionToken, readSessionToken, sessionHasRole, SESSION_COOKIE, SESSION_TTL_SECONDS } = await import("../lib/auth");
const { csvCell } = await import("../app/api/export/route");
const exportRoute = await import("../app/api/export/route");
const categoriesRoute = await import("../app/api/categories/route");
const categoryIdRoute = await import("../app/api/categories/[id]/route");
const statsRoute = await import("../app/api/stats/route");
const movementsRoute = await import("../app/api/movements/route");
const movementIdRoute = await import("../app/api/movements/[id]/route");
const productsRoute = await import("../app/api/products/route");
const productIdRoute = await import("../app/api/products/[id]/route");
const suppliersRoute = await import("../app/api/suppliers/route");
const supplierIdRoute = await import("../app/api/suppliers/[id]/route");
const loginRoute = await import("../app/api/auth/login/route");
const nextConfig = (await import("../next.config")).default;

function sessionFor(role: "admin" | "viewer") {
  const session = readSessionToken(createSessionToken(role));
  if (!session) throw new Error("test session could not be created");
  return session;
}

const adminSession = sessionFor("admin");
const viewerSession = sessionFor("viewer");

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

function authorizedRequest(
  url: string,
  init: RequestInit = {},
  role: "admin" | "viewer" = "admin",
): Request {
  const token = createSessionToken(role);
  if (!token) throw new Error("test session could not be created");
  const headers = new Headers(init.headers);
  headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  return new Request(url, { ...init, headers });
}

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
    Origin: "https://inventory.test",
    "Sec-Fetch-Site": "same-origin",
  };
}

test("a rejected direct quantity update cannot bypass the stock ledger", () => {
  const product = repo.createProduct(adminSession, validProduct("SEC-QUANTITY", 5));

  assert.throws(
    () => repo.updateProduct(adminSession, product.id, { quantity: 999 }),
    repo.ValidationError,
  );
  assert.equal(repo.getProduct(adminSession, product.id).quantity, 5);
  assert.equal(repo.listMovements(adminSession, { productId: product.id }).length, 1);
});

test("deleting a receipt cannot leave negative stock", () => {
  const product = repo.createProduct(adminSession, validProduct("SEC-DELETE", 10));
  repo.createMovement(adminSession, { product_id: product.id, type: "out", quantity: 4 });
  assert.equal(repo.getProduct(adminSession, product.id).quantity, 6);

  const receipt = repo.listMovements(adminSession, { productId: product.id, type: "in" })[0];
  assert.throws(() => repo.deleteMovement(adminSession, receipt.id), repo.ValidationError);
  assert.equal(repo.getProduct(adminSession, product.id).quantity, 6);
  assert.ok(repo.listMovements(adminSession, { productId: product.id }).some((row) => row.id === receipt.id));
});

test("deleting a product cannot erase its stock-movement history", async () => {
  const product = repo.createProduct(adminSession, validProduct("SEC-PRODUCT-DELETE", 5));
  repo.createMovement(adminSession, { product_id: product.id, type: "out", quantity: 2 });
  const movementsBefore = repo.listMovements(adminSession, { productId: product.id });
  assert.ok(movementsBefore.length >= 2);

  assert.throws(
    () => repo.deleteProduct(adminSession, product.id),
    (error: unknown) => error instanceof repo.ConflictError,
  );

  const deleteResponse = await productIdRoute.DELETE(
    authorizedRequest(`https://inventory.test/api/products/${product.id}`, {
      method: "DELETE",
      headers: { Origin: "https://inventory.test" },
    }),
    { params: Promise.resolve({ id: String(product.id) }) },
  );
  assert.equal(deleteResponse.status, 409);
  assert.equal(repo.getProduct(adminSession, product.id).id, product.id);
  assert.deepEqual(
    repo.listMovements(adminSession, { productId: product.id }),
    movementsBefore,
  );

  const db = (await import("../lib/db")).getDb();
  assert.throws(
    () => db.prepare("DELETE FROM products WHERE id = ?").run(product.id),
    /FOREIGN KEY constraint failed/,
  );
  assert.equal(repo.getProduct(adminSession, product.id).id, product.id);
  assert.deepEqual(
    repo.listMovements(adminSession, { productId: product.id }),
    movementsBefore,
  );

  const emptyProduct = repo.createProduct(adminSession, validProduct("SEC-PRODUCT-DELETE-EMPTY", 0));
  repo.deleteProduct(adminSession, emptyProduct.id);
  assert.throws(() => repo.getProduct(adminSession, emptyProduct.id), repo.NotFoundError);
});

test("repository operations fail closed without a verified admin session", () => {
  const product = repo.createProduct(adminSession, validProduct("SEC-REPO-GUARD"));
  const category = repo.createCategory(adminSession, { name: "SEC-REPO-GUARD" });
  const productCount = repo.listProducts(adminSession).length;

  const anonymous = (error: unknown) =>
    error instanceof repo.AuthorizationError && error.status === 401;
  const viewer = (error: unknown) =>
    error instanceof repo.AuthorizationError && error.status === 403;

  assert.throws(() => repo.listProducts(null), anonymous);
  assert.throws(() => repo.getProduct(null, product.id), anonymous);
  assert.throws(() => repo.createCategory(null, { name: "SEC-REPO-ANON" }), anonymous);
  assert.throws(() => repo.deleteProduct(null, product.id), anonymous);

  assert.throws(() => repo.listProducts(viewerSession), viewer);
  assert.throws(() => repo.createProduct(viewerSession, validProduct("SEC-REPO-VIEWER")), viewer);
  assert.throws(() => repo.deleteProduct(viewerSession, product.id), viewer);
  assert.throws(() => repo.deleteCategory(viewerSession, category.id), viewer);

  assert.equal(repo.getProduct(adminSession, product.id).id, product.id);
  assert.equal(repo.listProducts(adminSession).length, productCount);
  assert.ok(repo.listCategories(adminSession).some((row) => row.id === category.id));
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
    authorizedRequest("https://inventory.test/api/movements?limit=not-a-number"),
  );
  assert.equal(response.status, 400);
});

test("malformed product filters and sorts return 400", async () => {
  for (const query of ["category_id=not-a-number", "supplier_id=0", "sort=sql-injection"]) {
    const response = await productsRoute.GET(
      authorizedRequest(`https://inventory.test/api/products?${query}`),
    );
    assert.equal(response.status, 400, query);
  }
});

test("persisted quantities and text have enforceable bounds", () => {
  assert.throws(
    () => repo.createProduct(adminSession, validProduct("SEC-HUGE", 1_000_000_001)),
    repo.ValidationError,
  );
  assert.throws(() => repo.createCategory(adminSession, { name: "x".repeat(129) }), repo.ValidationError);
});

test("anonymous callers cannot read any inventory, stats or export data", async () => {
  const product = repo.createProduct(adminSession, validProduct("SEC-ANON-READ"));
  const responses = [
    await productsRoute.GET(new Request("https://inventory.test/api/products")),
    await productIdRoute.GET(
      new Request(`https://inventory.test/api/products/${product.id}`),
      { params: Promise.resolve({ id: String(product.id) }) },
    ),
    await categoriesRoute.GET(new Request("https://inventory.test/api/categories")),
    await suppliersRoute.GET(new Request("https://inventory.test/api/suppliers")),
    await movementsRoute.GET(new Request("https://inventory.test/api/movements")),
    await statsRoute.GET(new Request("https://inventory.test/api/stats")),
    await exportRoute.GET(new Request("https://inventory.test/api/export")),
  ];

  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
});

test("anonymous callers cannot create or delete records", async () => {
  const productCount = repo.listProducts(adminSession).length;
  const productResponse = await productsRoute.POST(
    new Request("https://inventory.test/api/products", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(validProduct("SEC-ANON")),
    }),
  );
  assert.equal(productResponse.status, 401);
  assert.equal(repo.listProducts(adminSession).length, productCount);

  const category = repo.createCategory(adminSession, { name: "SEC-ANON-DELETE" });
  const deleteResponse = await categoryIdRoute.DELETE(
    new Request(`https://inventory.test/api/categories/${category.id}`, {
      method: "DELETE",
      headers: { Origin: "https://inventory.test" },
    }),
    { params: Promise.resolve({ id: String(category.id) }) },
  );
  assert.equal(deleteResponse.status, 401);
  assert.ok(repo.listCategories(adminSession).some((row) => row.id === category.id));
});

test("movement deletion requires an admin session and preserves stock history", async () => {
  const product = repo.createProduct(adminSession, validProduct("SEC-MOVE-DELETE", 5));
  const movement = repo.createMovement(adminSession, {
    product_id: product.id,
    type: "out",
    quantity: 2,
  });
  const movementCount = repo.listMovements(adminSession, { productId: product.id }).length;
  const quantityAfterMovement = repo.getProduct(adminSession, product.id).quantity;

  const anonymous = (error: unknown) =>
    error instanceof repo.AuthorizationError && error.status === 401;
  const viewer = (error: unknown) =>
    error instanceof repo.AuthorizationError && error.status === 403;

  assert.throws(() => repo.deleteMovement(null, movement.id), anonymous);
  assert.throws(() => repo.deleteMovement(viewerSession, movement.id), viewer);

  const anonymousDelete = await movementIdRoute.DELETE(
    new Request(`https://inventory.test/api/movements/${movement.id}`, {
      method: "DELETE",
      headers: { Origin: "https://inventory.test" },
    }),
    { params: Promise.resolve({ id: String(movement.id) }) },
  );
  assert.equal(anonymousDelete.status, 401);

  const viewerDelete = await movementIdRoute.DELETE(
    authorizedRequest(
      `https://inventory.test/api/movements/${movement.id}`,
      { method: "DELETE", headers: { Origin: "https://inventory.test" } },
      "viewer",
    ),
    { params: Promise.resolve({ id: String(movement.id) }) },
  );
  assert.equal(viewerDelete.status, 403);

  assert.equal(repo.getProduct(adminSession, product.id).quantity, quantityAfterMovement);
  assert.equal(
    repo.listMovements(adminSession, { productId: product.id }).length,
    movementCount,
  );

  const adminDelete = await movementIdRoute.DELETE(
    authorizedRequest(
      `https://inventory.test/api/movements/${movement.id}`,
      { method: "DELETE", headers: { Origin: "https://inventory.test" } },
      "admin",
    ),
    { params: Promise.resolve({ id: String(movement.id) }) },
  );
  assert.equal(adminDelete.status, 200);
  assert.equal(repo.getProduct(adminSession, product.id).quantity, 5);
  assert.equal(
    repo.listMovements(adminSession, { productId: product.id }).length,
    movementCount - 1,
  );
});

test("an authenticated viewer cannot read, export or mutate inventory", async () => {
  const readResponse = await productsRoute.GET(
    authorizedRequest("https://inventory.test/api/products", {}, "viewer"),
  );
  assert.equal(readResponse.status, 403);

  const exportResponse = await exportRoute.GET(
    authorizedRequest("https://inventory.test/api/export", {}, "viewer"),
  );
  assert.equal(exportResponse.status, 403);

  const supplierReadResponse = await suppliersRoute.GET(
    authorizedRequest("https://inventory.test/api/suppliers", {}, "viewer"),
  );
  assert.equal(supplierReadResponse.status, 403);

  const categoryReadResponse = await categoriesRoute.GET(
    authorizedRequest("https://inventory.test/api/categories", {}, "viewer"),
  );
  assert.equal(categoryReadResponse.status, 403);

  const detailProduct = repo.createProduct(adminSession, validProduct("SEC-VIEWER-READ"));
  const productDetailResponse = await productIdRoute.GET(
    authorizedRequest(`https://inventory.test/api/products/${detailProduct.id}`, {}, "viewer"),
    { params: Promise.resolve({ id: String(detailProduct.id) }) },
  );
  assert.equal(productDetailResponse.status, 403);

  const movementReadResponse = await movementsRoute.GET(
    authorizedRequest("https://inventory.test/api/movements", {}, "viewer"),
  );
  assert.equal(movementReadResponse.status, 403);

  const statsReadResponse = await statsRoute.GET(
    authorizedRequest("https://inventory.test/api/stats", {}, "viewer"),
  );
  assert.equal(statsReadResponse.status, 403);

  const productCount = repo.listProducts(adminSession).length;
  const createResponse = await productsRoute.POST(
    authorizedRequest(
      "https://inventory.test/api/products",
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(validProduct("SEC-VIEWER")),
      },
      "viewer",
    ),
  );
  assert.equal(createResponse.status, 403);
  assert.equal(repo.listProducts(adminSession).length, productCount);

  const category = repo.createCategory(adminSession, { name: "SEC-VIEWER-DELETE" });
  const deleteResponse = await categoryIdRoute.DELETE(
    authorizedRequest(
      `https://inventory.test/api/categories/${category.id}`,
      { method: "DELETE", headers: { Origin: "https://inventory.test" } },
      "viewer",
    ),
    { params: Promise.resolve({ id: String(category.id) }) },
  );
  assert.equal(deleteResponse.status, 403);
  assert.ok(repo.listCategories(adminSession).some((row) => row.id === category.id));
});

test("supplier mutations require an admin session", async () => {
  const existing = repo.createSupplier(adminSession, { name: "SEC-SUPPLIER-BASE", lead_time_days: 3 });
  const supplierCount = repo.listSuppliers(adminSession).length;

  const anonymousCreate = await suppliersRoute.POST(
    new Request("https://inventory.test/api/suppliers", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ name: "SEC-SUPPLIER-ANON", lead_time_days: 3 }),
    }),
  );
  assert.equal(anonymousCreate.status, 401);
  assert.equal(repo.listSuppliers(adminSession).length, supplierCount);

  const anonymousUpdate = await supplierIdRoute.PATCH(
    new Request(`https://inventory.test/api/suppliers/${existing.id}`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({ name: "SEC-SUPPLIER-ANON-UPDATED", lead_time_days: 3 }),
    }),
    { params: Promise.resolve({ id: String(existing.id) }) },
  );
  assert.equal(anonymousUpdate.status, 401);

  const anonymousDelete = await supplierIdRoute.DELETE(
    new Request(`https://inventory.test/api/suppliers/${existing.id}`, {
      method: "DELETE",
      headers: { Origin: "https://inventory.test" },
    }),
    { params: Promise.resolve({ id: String(existing.id) }) },
  );
  assert.equal(anonymousDelete.status, 401);

  const viewerCreate = await suppliersRoute.POST(
    authorizedRequest(
      "https://inventory.test/api/suppliers",
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ name: "SEC-SUPPLIER-VIEWER", lead_time_days: 3 }),
      },
      "viewer",
    ),
  );
  assert.equal(viewerCreate.status, 403);
  assert.equal(repo.listSuppliers(adminSession).length, supplierCount);

  const viewerUpdate = await supplierIdRoute.PATCH(
    authorizedRequest(
      `https://inventory.test/api/suppliers/${existing.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ name: "SEC-SUPPLIER-VIEWER-UPDATED", lead_time_days: 3 }),
      },
      "viewer",
    ),
    { params: Promise.resolve({ id: String(existing.id) }) },
  );
  assert.equal(viewerUpdate.status, 403);

  const viewerDelete = await supplierIdRoute.DELETE(
    authorizedRequest(
      `https://inventory.test/api/suppliers/${existing.id}`,
      { method: "DELETE", headers: { Origin: "https://inventory.test" } },
      "viewer",
    ),
    { params: Promise.resolve({ id: String(existing.id) }) },
  );
  assert.equal(viewerDelete.status, 403);

  const unchanged = repo.listSuppliers(adminSession).find((row) => row.id === existing.id);
  assert.ok(unchanged);
  assert.equal(unchanged.name, "SEC-SUPPLIER-BASE");

  const adminCreate = await suppliersRoute.POST(
    authorizedRequest("https://inventory.test/api/suppliers", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ name: "SEC-SUPPLIER-ADMIN", lead_time_days: 3 }),
    }),
  );
  assert.equal(adminCreate.status, 201);
  const created = (await adminCreate.json()) as { id: number };
  assert.ok(created.id);

  const adminUpdate = await supplierIdRoute.PATCH(
    authorizedRequest(`https://inventory.test/api/suppliers/${created.id}`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({ name: "SEC-SUPPLIER-ADMIN-UPDATED", lead_time_days: 4 }),
    }),
    { params: Promise.resolve({ id: String(created.id) }) },
  );
  assert.equal(adminUpdate.status, 200);
  assert.equal(((await adminUpdate.json()) as { name: string }).name, "SEC-SUPPLIER-ADMIN-UPDATED");

  const adminDelete = await supplierIdRoute.DELETE(
    authorizedRequest(`https://inventory.test/api/suppliers/${created.id}`, {
      method: "DELETE",
      headers: { Origin: "https://inventory.test" },
    }),
    { params: Promise.resolve({ id: String(created.id) }) },
  );
  assert.equal(adminDelete.status, 200);
  assert.equal(repo.listSuppliers(adminSession).some((row) => row.id === created.id), false);
});

test("an admin session retains legitimate inventory access", async () => {
  const response = await productsRoute.GET(
    authorizedRequest("https://inventory.test/api/products"),
  );
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(await response.json()));
});

test("admin-only page policy rejects viewer sessions and covers every inventory route", () => {
  const viewer = readSessionToken(createSessionToken("viewer"));
  const admin = readSessionToken(createSessionToken("admin"));
  assert.ok(viewer);
  assert.ok(admin);
  assert.equal(sessionHasRole(null, "admin"), false);
  assert.equal(sessionHasRole(viewer, "admin"), false);
  assert.equal(sessionHasRole(admin, "admin"), true);

  const inventoryDir = path.join(process.cwd(), "app/(inventory)");
  const routeFiles = readdirSync(inventoryDir, { recursive: true })
    .filter((file) => String(file).endsWith("page.tsx") || String(file).endsWith("layout.tsx"))
    .map((file) => path.join(inventoryDir, String(file)));
  assert.ok(routeFiles.length >= 6);

  for (const file of routeFiles) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /await\s+requirePageSession\("admin"\)/, file);
  }

  const guardSource = readFileSync(path.join(process.cwd(), "lib/page-auth.ts"), "utf8");
  assert.match(guardSource, /if\s*\(!sessionHasRole\(session, role\)\)\s*notFound\(\)/);
});

test("administrator login issues a signed HttpOnly strict cookie", async () => {
  const response = await loginRoute.POST(
    new Request("https://inventory.test/api/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ password: process.env.STOCKROOM_ADMIN_PASSWORD }),
    }),
  );
  assert.equal(response.status, 200);

  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=strict/i);

  const token = setCookie.split(";", 1)[0].slice(SESSION_COOKIE.length + 1);
  assert.ok(readSessionToken(token));
});

test("invalid credentials do not issue a session", async () => {
  const response = await loginRoute.POST(
    new Request("https://inventory.test/api/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ password: "wrong-password-1234" }),
    }),
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("forged and expired sessions are rejected", () => {
  const token = createSessionToken("admin");
  assert.ok(token);

  const [payload, signature] = token.split(".");
  const tampered = `${payload[0] === "a" ? "b" : "a"}${payload.slice(1)}.${signature}`;
  assert.equal(readSessionToken(tampered), null);

  const realNow = Date.now;
  try {
    Date.now = () => realNow() + (SESSION_TTL_SECONDS + 1) * 1000;
    assert.equal(readSessionToken(token), null);
  } finally {
    Date.now = realNow;
  }
});

test("missing session configuration fails closed", () => {
  const token = createSessionToken("admin");
  assert.ok(token);

  const savedSecret = process.env.STOCKROOM_SESSION_SECRET;
  delete process.env.STOCKROOM_SESSION_SECRET;
  try {
    assert.equal(readSessionToken(token), null);
  } finally {
    process.env.STOCKROOM_SESSION_SECRET = savedSecret;
  }
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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
