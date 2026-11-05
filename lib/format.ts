export function currency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function compactCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function number(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** SQLite stores UTC timestamps without a zone; treat them as UTC. */
export function parseDbDate(value: string): Date {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

export function shortDate(value: string): string {
  return parseDbDate(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function dateTime(value: string): string {
  return parseDbDate(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(value: string): string {
  const diffMs = Date.now() - parseDbDate(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return shortDate(value);
}

export function stockStatus(product: { quantity: number; reorder_level: number }) {
  if (product.quantity === 0) return { label: "Out of stock", tone: "danger" as const };
  if (product.quantity <= product.reorder_level) return { label: "Low stock", tone: "warning" as const };
  return { label: "In stock", tone: "success" as const };
}
