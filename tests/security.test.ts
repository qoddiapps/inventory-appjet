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
const productsRoute = await import("../app/api/products/route");
const loginRoute = await import("../app/api/auth/login/route");
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
    () => repo.createProduct(validProduct("SEC-HUGE", 1_000_000_001)),
    repo.ValidationError,
  );
  assert.throws(() => repo.createCategory({ name: "x".repeat(129) }), repo.ValidationError);
});

test("anonymous callers cannot read inventory, stats or export data", async () => {
  const responses = [
    await productsRoute.GET(new Request("https://inventory.test/api/products")),
    await categoriesRoute.GET(new Request("https://inventory.test/api/categories")),
    await statsRoute.GET(new Request("https://inventory.test/api/stats")),
    await exportRoute.GET(new Request("https://inventory.test/api/export")),
  ];

  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
});

test("anonymous callers cannot create or delete records", async () => {
  const productCount = repo.listProducts().length;
  const productResponse = await productsRoute.POST(
    new Request("https://inventory.test/api/products", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(validProduct("SEC-ANON")),
    }),
  );
  assert.equal(productResponse.status, 401);
  assert.equal(repo.listProducts().length, productCount);

  const category = repo.createCategory({ name: "SEC-ANON-DELETE" });
  const deleteResponse = await categoryIdRoute.DELETE(
    new Request(`https://inventory.test/api/categories/${category.id}`, {
      method: "DELETE",
      headers: { Origin: "https://inventory.test" },
    }),
    { params: Promise.resolve({ id: String(category.id) }) },
  );
  assert.equal(deleteResponse.status, 401);
  assert.ok(repo.listCategories().some((row) => row.id === category.id));
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

  const productCount = repo.listProducts().length;
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
  assert.equal(repo.listProducts().length, productCount);

  const category = repo.createCategory({ name: "SEC-VIEWER-DELETE" });
  const deleteResponse = await categoryIdRoute.DELETE(
    authorizedRequest(
      `https://inventory.test/api/categories/${category.id}`,
      { method: "DELETE", headers: { Origin: "https://inventory.test" } },
      "viewer",
    ),
    { params: Promise.resolve({ id: String(category.id) }) },
  );
  assert.equal(deleteResponse.status, 403);
  assert.ok(repo.listCategories().some((row) => row.id === category.id));
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
    .filter((file) => file.endsWith("page.tsx") || file.endsWith("layout.tsx"))
    .map((file) => path.join(inventoryDir, file));
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
