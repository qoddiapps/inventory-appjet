import type { Product } from "@/lib/types";
import { Badge } from "./ui";

export function StockBadge({ product }: { product: Pick<Product, "quantity" | "reorder_level"> }) {
  if (product.quantity === 0) return <Badge tone="danger">Out</Badge>;
  if (product.quantity <= product.reorder_level) return <Badge tone="warning">Low</Badge>;
  return <Badge tone="success">OK</Badge>;
}
