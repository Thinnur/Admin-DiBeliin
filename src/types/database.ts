// =============================================================================
// DiBeliin Admin - Database Types
// =============================================================================
// TypeScript interfaces matching Supabase schema (snake_case to match DB)

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------
export type AccountBrand = 'kopken' | 'fore';

export type AccountStatus = 'ready' | 'booked' | 'sold' | 'expired' | 'issue';

export type TransactionType = 'income' | 'expense';

// -----------------------------------------------------------------------------
// Database Tables
// -----------------------------------------------------------------------------

/**
 * Account entity - Represents a coffee shop account in inventory
 */
export interface Account {
  id: string;
  phone_number: string;
  password: string;
  brand: AccountBrand;
  voucher_type: string;
  expiry_date: string; // ISO date string (YYYY-MM-DD)
  status: AccountStatus; // Global health status (e.g., 'issue' if password wrong, 'expired' if expired)
  is_nomin_ready: boolean; // Voucher No Min availability
  is_min50k_ready: boolean; // Voucher Min 50k availability (KopKen only, always false for Fore)
  purchase_price: number;
  notes: string | null;
  created_at: string; // ISO timestamp
}

/**
 * Transaction entity - Represents a financial transaction
 */
export interface Transaction {
  id: string;
  transaction_type: TransactionType;
  amount: number;
  category: string;
  description: string;
  related_account_id: string | null;
  created_at: string; // ISO timestamp
}

// -----------------------------------------------------------------------------
// Insert/Update Types (for mutations)
// -----------------------------------------------------------------------------

export type AccountInsert = Omit<Account, 'id' | 'created_at'>;
export type AccountUpdate = Partial<AccountInsert>;

export type TransactionInsert = Omit<Transaction, 'id' | 'created_at'>;
export type TransactionUpdate = Partial<TransactionInsert>;

// -----------------------------------------------------------------------------
// Filter Types
// -----------------------------------------------------------------------------

export interface AccountFilters {
  brand?: AccountBrand;
  status?: AccountStatus;
  expiry_before?: string; // Filter accounts expiring before this date
  expiry_after?: string;  // Filter accounts expiring after this date
}

export interface TransactionFilters {
  transaction_type?: TransactionType;
  category?: string;
  date_from?: string;
  date_to?: string;
}

// -----------------------------------------------------------------------------
// Derived/Computed Types
// -----------------------------------------------------------------------------

/**
 * Statistics for account inventory dashboard
 */
export interface AccountStatistics {
  total: number;
  by_status: Record<AccountStatus, number>;
  by_brand: Record<AccountBrand, number>;
  expiring_soon: number; // Accounts expiring within 3 days
  total_value: number;   // Sum of purchase_price for ready accounts
}

/**
 * Financial summary for dashboard
 */
export interface FinancialSummary {
  total_income: number;
  total_expense: number;
  net_profit: number;
  transactions_count: number;
}

// -----------------------------------------------------------------------------
// Auto-Assign Types
// -----------------------------------------------------------------------------

export interface AutoAssignRequest {
  brand: AccountBrand;
  voucher_type?: string;
}

export interface AutoAssignResult {
  account: Account | null;
  message: string;
  available_count: number;
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  total_pages: number;
}
