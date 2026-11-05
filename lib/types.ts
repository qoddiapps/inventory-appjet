export type MovementType = "in" | "out" | "adjust";

export interface Category {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  product_count?: number;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  lead_time_days: number;
  created_at: string;
  product_count?: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category_id: number | null;
  supplier_id: number | null;
  category_name?: string | null;
  supplier_name?: string | null;
  unit_price: number;
  cost_price: number;
  quantity: number;
  reorder_level: number;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: number;
  product_id: number;
  type: MovementType;
  quantity: number;
  delta: number;
  reason: string | null;
  reference: string | null;
  created_at: string;
  product_name?: string;
  product_sku?: string;
}

export interface Stats {
  product_count: number;
  total_units: number;
  inventory_cost: number;
  inventory_retail: number;
  low_stock_count: number;
  out_of_stock_count: number;
  category_count: number;
  supplier_count: number;
  low_stock: Product[];
  recent_movements: StockMovement[];
  category_breakdown: { name: string; units: number; value: number }[];
}
