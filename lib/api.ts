import { NextResponse } from "next/server";
import { NotFoundError, ValidationError } from "./repo";

const MAX_JSON_BYTES = 64 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function fail(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message, issues: error.issues },
      { status: 400, headers: NO_STORE },
    );
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404, headers: NO_STORE });
  }
  console.error("[api] unexpected error", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500, headers: NO_STORE });
}

export function parseId(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) throw new ValidationError(["Invalid id"]);
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new ValidationError(["Invalid id"]);
  return id;
}

export function parseOptionalId(value: string | null): number | undefined {
  return value === null ? undefined : parseId(value);
}

export function parseLimit(value: string | null): number | undefined {
  if (value === null) return undefined;
  return Math.min(parseId(value), 500);
}

export function parseProductSort(
  value: string | null,
): "name" | "quantity" | "value" | "updated" | undefined {
  if (value === null) return undefined;
  if (value === "name" || value === "quantity" || value === "value" || value === "updated") {
    return value;
  }
  throw new ValidationError(["Sort must be name, quantity, value or updated"]);
}

export function parseMovementType(value: string | null): "in" | "out" | "adjust" | undefined {
  if (value === null) return undefined;
  if (value === "in" || value === "out" || value === "adjust") return value;
  throw new ValidationError(["Type must be in, out or adjust"]);
}

/**
 * Browser writes must originate from this application. Non-browser API clients
 * remain supported because they normally send neither Origin nor Sec-Fetch-Site.
 */
export function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  const origin = request.headers.get("origin");
  if (fetchSite === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    throw new HttpError(403, "Cross-site writes are not allowed");
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  assertSameOrigin(request);

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpError(415, "Content-Type must be application/json");
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new HttpError(413, "JSON request body is too large");
  }

  try {
    if (!request.body) throw new ValidationError(["Request body must be valid JSON"]);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_JSON_BYTES) {
        void reader.cancel();
        throw new HttpError(413, "JSON request body is too large");
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ValidationError(["Request body must be a JSON object"]);
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof HttpError) throw error;
    throw new ValidationError(["Request body must be valid JSON"]);
  }
}
