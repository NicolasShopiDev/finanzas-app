// Database interfaces for personal finance app

export interface MonthlyBudget {
  _id: string;
  month: number; // 1-12
  year: number;
  total_budget: number;
  createdAt: string;
  updatedAt: string;
}

// Name history entry for tracking category name changes over time
export interface CategoryNameHistoryEntry {
  name: string;
  changed_at: string; // ISO date string
}

export interface Category {
  _id: string;
  name: string;
  type: "fija" | "variable";
  percentage: number; // Percentage of budget allocated
  fixed_amount: number | null; // For fixed categories
  icon: string; // Emoji icon
  monthly_budget?: string | MonthlyBudget; // Reference to monthly budget (legacy, kept for backwards compatibility)
  is_active: "si" | "no"; // Whether category is active for future use
  deleted_at?: string | null; // Date when category was deactivated
  name_history?: string | CategoryNameHistoryEntry[]; // JSON string or parsed array of name changes
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  _id: string;
  description: string;
  amount: number;
  date: string;
  category?: string | Category; // Reference to category
  createdAt: string;
  updatedAt: string;
}

// Extended types for nested data
export interface CategoryWithExpenses extends Category {
  expenses?: Expense[];
}

export interface MonthlyBudgetWithCategories extends MonthlyBudget {
  categories?: CategoryWithExpenses[];
}

// API response types
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: unknown;
}

// Form types
export interface CreateCategoryForm {
  name: string;
  type: "fija" | "variable";
  percentage?: number;
  fixed_amount?: number;
  icon: string;
}

export interface CreateExpenseForm {
  description: string;
  amount: number;
  date: string;
  category: string;
}

export interface CreateBudgetForm {
  month: number;
  year: number;
  total_budget: number;
}

// Bank Connection interfaces
export interface BankConnection {
  _id: string;
  bank_name: string;
  bank_id: string;
  requisition_id: string;
  account_id: string;
  status: "pendiente" | "conectado" | "error" | "expirado";
  last_sync: string | null;
  iban: string;
  account_name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransaction {
  _id: string;
  transaction_id: string;
  description: string;
  amount: number;
  currency: string;
  booking_date: string;
  value_date: string;
  merchant_name: string;
  transaction_type: "ingreso" | "gasto" | "transferencia";
  is_processed: "si" | "no";
  bank_connection?: string | BankConnection;
  category?: string | Category;
  createdAt: string;
  updatedAt: string;
}

export interface NordigenConfig {
  _id: string;
  secret_id: string;
  secret_key: string;
  access_token: string;
  refresh_token: string;
  token_expires: string | null;
  is_configured: "si" | "no";
  createdAt: string;
  updatedAt: string;
}

export interface KlarnaConfig {
  _id: string;
  api_token: string;
  is_configured: "si" | "no";
  createdAt: string;
  updatedAt: string;
}

// Bank/Institution from Nordigen API
export interface NordigenInstitution {
  id: string;
  name: string;
  bic: string;
  transaction_total_days: string;
  countries: string[];
  logo: string;
}

// Form types for bank connection
export interface SaveNordigenCredentialsForm {
  secret_id: string;
  secret_key: string;
}

// Nordigen API response types
export interface NordigenTokenResponse {
  access: string;
  access_expires: number;
  refresh: string;
  refresh_expires: number;
}

export interface NordigenRequisitionResponse {
  id: string;
  created: string;
  redirect: string;
  status: string;
  institution_id: string;
  agreement: string;
  link: string;
  accounts: string[];
  user_language: string;
}

export interface NordigenAccountDetails {
  account: {
    iban?: string;
    name?: string;
    ownerName?: string;
    currency?: string;
    product?: string;
  };
}

export interface NordigenEUAResponse {
  id: string;
  created: string;
  max_historical_days: number;
  access_valid_for_days: number;
  access_scope: string[];
  accepted: string | null;
  institution_id: string;
}

export interface NordigenTransaction {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount?: {
    amount: string;
    currency: string;
  };
  remittanceInformationUnstructured?: string;
  additionalInformation?: string;
  creditorName?: string;
  debtorName?: string;
}

export interface NordigenTransactionsResponse {
  transactions: {
    booked: NordigenTransaction[];
    pending?: NordigenTransaction[];
  };
}

export interface NordigenErrorResponse {
  summary?: string;
  detail?: string;
  status_code?: number;
}

// Gamification interfaces
export interface UserStreak {
  _id: string;
  current_streak: number;
  best_streak: number;
  last_no_spend_date: string | null;
  streak_broken_count: number;
  total_no_spend_days: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyMission {
  _id: string;
  mission_type: "reduce_food" | "reduce_transport" | "reduce_entertainment" | "reduce_clothing" | "increase_savings";
  target_percentage: number;
  week_start: string;
  week_end: string;
  status: "active" | "completed" | "failed";
  previous_week_amount: number;
  current_week_amount: number;
  category_name: string;
  createdAt: string;
  updatedAt: string;
}

// Smart Alerts interfaces
export interface SmartAlert {
  _id: string;
  alert_type: "presupuesto_excedido" | "prevision_deficit" | "patron_detectado" | "colchon_peligro" | "oportunidad_ahorro";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  category_name: string | null;
  amount_involved: number | null;
  recommended_action: string;
  is_dismissed: "si" | "no";
  generated_at: string;
  createdAt: string;
  updatedAt: string;
}

// AI Alert Analysis Response
export interface AlertAnalysis {
  alerts: SmartAlert[];
  summary: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    totalAlerts: number;
  };
  prediction: {
    endOfMonthBalance: number;
    riskLevel: "low" | "medium" | "high";
    daysUntilDanger: number | null;
    safetyMargin: number;
  };
}

// Category spending analysis for AI
export interface CategorySpendingAnalysis {
  categoryName: string;
  budgetAllocated: number;
  amountSpent: number;
  percentageUsed: number;
  isOverBudget: boolean;
  daysLeft: number;
  projectedOverspend: number;
}

// Gamification computed data
export interface MonthPrediction {
  predictedRunOutDay: number | null; // Day of month when budget runs out, null if won't run out
  currentSpendRate: number; // Average daily spend rate
  projectedMonthEnd: number; // Projected remaining budget at month end
  daysRemaining: number;
  budgetRemaining: number;
  isOnTrack: boolean;
}

export interface GamificationData {
  streak: UserStreak | null;
  mission: WeeklyMission | null;
  prediction: MonthPrediction;
  thermometer: {
    percentage: number; // 0-100, how much budget used
    budgetTotal: number;
    budgetUsed: number;
    budgetRemaining: number;
    status: "good" | "warning" | "danger";
  };
}

// Multi-currency interfaces
export interface UserSettings {
  _id: string;
  base_currency: "eur" | "usd" | "gbp" | "chf" | "jpy" | "aud" | "cad" | "mxn";
  base_currency_symbol: string;
  default_country: string;
  date_format: "dd/mm/yyyy" | "mm/dd/yyyy" | "yyyy-mm-dd";
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeRateCache {
  _id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  rate_date: string;
  fetched_at: string;
  createdAt: string;
  updatedAt: string;
}

// Extended Expense interface with multi-currency support
export interface ExpenseWithCurrency extends Expense {
  original_currency?: string;
  original_amount?: number;
  exchange_rate?: number;
  base_currency_amount?: number;
}

// Extended BankTransaction interface with multi-currency support
export interface BankTransactionWithCurrency extends BankTransaction {
  original_currency?: string;
  original_amount?: number;
  exchange_rate?: number;
  base_currency_amount?: number;
}

// Currency metadata
export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

// Form types for multi-currency expense
export interface CreateExpenseWithCurrencyForm {
  description: string;
  original_amount: number;
  original_currency: string;
  date: string;
  category: string;
}

// ============================================
// INCOME & SAVINGS MODEL INTERFACES
// ============================================

// Income - represents any money entry from external sources
export interface Income {
  _id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  origin: "manual" | "importado";
  income_type: "recurrente" | "puntual" | "transferencia_interna";
  status: "confirmado" | "pendiente_revision";
  source_name: string;
  bank_reference?: string;
  month: number;
  year: number;
  distributed_to_budget: number;
  distributed_to_savings: number;
  distributed_to_free: number;
  is_distributed: "si" | "no";
  createdAt: string;
  updatedAt: string;
}

// Savings - persistent savings container
export interface Savings {
  _id: string;
  total_balance: number;
  currency: string;
  last_updated: string;
  createdAt: string;
  updatedAt: string;
}

// Distribution Rule - global rule for distributing income
export interface DistributionRule {
  _id: string;
  budget_percentage: number;
  savings_percentage: number;
  free_percentage: number;
  is_active: "si" | "no";
  effective_from: string;
  createdAt: string;
  updatedAt: string;
}

// Savings Goal - logical allocation of savings towards specific targets
export interface SavingsGoal {
  _id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  priority: "alta" | "media" | "baja";
  status: "activo" | "pausado" | "completado";
  icon: string;
  target_date?: string;
  notes?: string;
  savings?: string | Savings;
  createdAt: string;
  updatedAt: string;
}

// Savings Movement - history of savings movements
export interface SavingsMovement {
  _id: string;
  movement_type: "entrada" | "salida" | "asignacion_objetivo";
  amount: number;
  date: string;
  description: string;
  source: "ingreso_automatico" | "transferencia_presupuesto" | "retiro" | "ajuste_manual";
  balance_after: number;
  savings?: string | Savings;
  savings_goal?: string | SavingsGoal;
  income?: string | Income;
  createdAt: string;
  updatedAt: string;
}

// Form types for Income & Savings
export interface CreateIncomeForm {
  description: string;
  amount: number;
  currency: string;
  date: string;
  income_type: "recurrente" | "puntual" | "transferencia_interna";
  source_name?: string;
}

export interface CreateSavingsGoalForm {
  name: string;
  target_amount: number;
  priority: "alta" | "media" | "baja";
  icon: string;
  target_date?: string;
  notes?: string;
}

export interface UpdateDistributionRuleForm {
  budget_percentage: number;
  savings_percentage: number;
  free_percentage: number;
}

// Financial Summary for dashboard
export interface FinancialSummary {
  month: number;
  year: number;
  // Income
  totalIncomeThisMonth: number;
  confirmedIncomeThisMonth: number;
  pendingIncomeCount: number;
  // Budget from income
  budgetFromIncome: number;
  manualBudgetAdjustment: number;
  totalBudget: number;
  // Expenses
  totalExpenses: number;
  budgetRemaining: number;
  // Savings
  totalSavings: number;
  savingsThisMonth: number;
  savingsGoalsCount: number;
  savingsGoalsProgress: number; // percentage
  // Distribution rule
  distributionRule: DistributionRule | null;
}
