/** Entry type for a logged transaction. */
export type EntryType = "expense" | "sale" | "spoilage";

/** Item category in the Item Master catalogue. */
export type ItemCategory =
  | "raw_material"
  | "finished_product"
  | "packaging"
  | "misc";

/** Supported measurement units for items and transactions. */
export type ItemUnit = "kg" | "litre" | "piece" | "bundle";

/** Vendor language preference. */
export type VendorLanguage = "en" | "hi";

/** Vendor gender. */
export type VendorGender = "male" | "female" | "other";

/** Row shape for the vendors table. */
export interface Vendor {
  id: string;
  phone: string;
  name: string | null;
  gender: VendorGender | null;
  dob: string | null;            // ISO date e.g. "1990-05-15"
  language: VendorLanguage;
  created_at: string;
}

/** Lightweight session info stored client-side. */
export interface VendorSession {
  vendor_id: string;
  phone: string;
  name: string | null;
  language: VendorLanguage;
}

/** Row shape for the items table (Item Master). */
export interface Item {
  id: string;
  vendor_id: string | null;
  name: string;
  aliases: string[] | null;
  category: ItemCategory | null;
  default_unit: ItemUnit;
  created_at: string;
}

/** Row shape for the suppliers table. */
export interface Supplier {
  id: string;
  vendor_id: string;
  name: string;
  phone: string | null;
  aliases: string[] | null;
  created_at: string;
}

/** A supplier candidate returned during fuzzy-match deduplication. */
export interface SupplierMatch {
  id: string;
  name: string;
  phone: string | null;
  /** Jaro-Winkler similarity score 0–1. */
  similarity: number;
}

/**
 * Represents a voice-logged transaction whose supplier could not be
 * auto-resolved (fuzzy match found but needs user confirmation).
 */
export interface PendingSupplier {
  /** ID of the saved transaction row (supplier_id is null until resolved). */
  transaction_id: string;
  /** Supplier name as Claude extracted it from voice. */
  parsed_name: string;
  /** Existing suppliers that are similar enough to warrant confirmation. */
  similar_matches: SupplierMatch[];
}

/** Row shape for the transactions table. */
export interface Transaction {
  id: string;
  vendor_id: string;
  entry_type: EntryType;
  item_id: string | null;
  item_name_raw: string | null;
  quantity: number | null;
  unit: ItemUnit | null;
  unit_price: number | null;
  total_amount: number;
  supplier_id: string | null;
  raw_voice_text: string | null;
  confidence: number | null;
  is_resolved: boolean;
  logged_at: string;
}

/** Row shape for the daily_summaries table. */
export interface DailySummary {
  id: string;
  vendor_id: string;
  date: string;
  total_expense: number;
  total_revenue: number;
  net_profit: number;
  spoilage_loss: number;
  margin_pct: number;
  summary_text_hi: string | null;
  sent_at: string | null;
}

/** Row shape for the price_history table. */
export interface PriceHistory {
  id: string;
  vendor_id: string;
  item_id: string;
  supplier_id: string | null;
  date: string;
  price_per_unit: number;
  unit: ItemUnit;
}

/** Single entry returned by Claude parse prompt. */
export interface ParsedEntry {
  entry_type: EntryType;
  item_name: string;
  quantity: number | null;
  unit: ItemUnit | null;
  unit_price: number | null;
  total_price: number;
  supplier_name: string | null;
  confidence: number;
}

/** Claude parse prompt response shape. */
export interface ParseVoiceResult {
  entries: ParsedEntry[];
}

/** Computed P&L for a single day. */
export interface PnLSummary {
  total_expense: number;
  total_revenue: number;
  net_profit: number;
  spoilage_loss: number;
  margin_pct: number;
  highest_cost_item: string | null;
  highest_cost_amount: number | null;
}

/** Response from POST /api/log-voice after successful processing. */
export interface LogVoiceResponse {
  success: boolean;
  entries: Transaction[];
  confirmation_text: string;
  unresolved_items?: ParsedEntry[];
  /** Suppliers that need user confirmation before being linked to a transaction. */
  pending_suppliers?: PendingSupplier[];
}

/** Response from GET /api/get-summary. */
export interface GetSummaryResponse {
  summary: PnLSummary;
  transactions: Transaction[];
  summary_text_hi: string | null;
}

/** Voice recorder UI state machine. */
export type VoiceRecorderState =
  | "idle"
  | "recording"
  | "processing"
  | "confirmed"
  | "error";

/** A single day's data point in the trend graph. */
export interface TrendPoint {
  date: string;          // ISO date e.g. "2026-07-08"
  net_profit: number;
  total_expense: number;
  total_revenue: number;
  has_data: boolean;     // false = vendor had no logs that day
}

/** Response from GET /api/trend. */
export interface TrendResponse {
  points: TrendPoint[];
  week_total: number;
  trend: "up" | "down" | "flat";
}
