import { NextResponse } from "next/server";
import { z } from "zod";
import { totalumSdk } from "@/lib/totalum";
import { convertCurrency } from "@/lib/exchange-rate";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/auth-utils";
import type { Expense, UserSettings, ExpenseWithCurrency } from "@/types/database";

function serializeError(err: unknown) {
  if (err instanceof AuthError) {
    return { message: err.message, code: "UNAUTHORIZED", name: err.name };
  }
  const e = err as { message?: string; code?: string; name?: string; response?: { status?: number; data?: unknown }; stack?: string };
  return {
    message: e?.message ?? "Unknown error",
    code: e?.code ?? null,
    name: e?.name ?? null,
    status: e?.response?.status ?? null,
    responseData: e?.response?.data ?? null,
    stack: e?.stack ?? null,
  };
}

// Schema for expense with optional multi-currency support
const createExpenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().min(0), // This will be the base currency amount OR original if no currency specified
  date: z.string(),
  category: z.string(),
  // Multi-currency fields (optional for backwards compatibility)
  original_currency: z.string().optional(),
  original_amount: z.number().optional(),
});

// Helper to get user's base currency
async function getBaseCurrency(userId: string): Promise<{ currency: string; symbol: string }> {
  try {
    const result = await totalumSdk.crud.getRecords<UserSettings>('user_settings', {
      filter: [{ user_id: userId }],
      pagination: { limit: 1, page: 0 },
    });
    if (result.data && result.data.length > 0) {
      return {
        currency: result.data[0].base_currency.toUpperCase(),
        symbol: result.data[0].base_currency_symbol,
      };
    }
  } catch (error) {
    console.error('[API] Error getting base currency:', error);
  }
  return { currency: 'EUR', symbol: '€' };
}

// GET - Get all expenses (including bank transactions)
export async function GET(req: Request) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("category_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    console.log("[API] GET /api/expenses - user:", user.id, "category_id:", categoryId, "dates:", startDate, endDate);

    // Prepare date filter object
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // 1. Fetch Manual Expenses
    const expenseFilter: Record<string, unknown>[] = [{ user_id: user.id }];
    if (categoryId) expenseFilter.push({ category: categoryId });
    if (startDate) expenseFilter.push({ date: { gte: startDate } });
    if (endDate) expenseFilter.push({ date: { lte: endDate } });

    const expensesPromise = totalumSdk.crud.getRecords<ExpenseWithCurrency>("expense",
      expenseFilter.length > 0 ? { filter: expenseFilter, pagination: { limit: 1000, page: 0 } } : { pagination: { limit: 1000, page: 0 } }
    );

    // 2. Fetch Bank Transactions (type="gasto")
    const bankFilter: Record<string, unknown>[] = [{ user_id: user.id }, { transaction_type: "gasto" }];
    // Note: bank transactions use 'booking_date', manually mapped to filters
    if (categoryId) bankFilter.push({ category: categoryId });
    // Note: bank transactions use 'booking_date'
    if (startDate) bankFilter.push({ booking_date: { gte: new Date(startDate) } });
    if (endDate) bankFilter.push({ booking_date: { lte: new Date(endDate) } });

    // Import BankTransaction type dynamically or assume it exists in database.ts
    // We using 'any' here for simplicity if type isn't imported, but we should import it.
    // Let's rely on the environment having the types.
    const bankPromise = totalumSdk.crud.getRecords<any>("bank_transaction",
      { filter: bankFilter, pagination: { limit: 1000, page: 0 } }
    );

    const [expensesResult, bankResult] = await Promise.all([expensesPromise, bankPromise]);

    const manualExpenses = expensesResult.data || [];
    const bankTransactions = bankResult.data || [];

    console.log(`[API] Found ${manualExpenses.length} manual expenses and ${bankTransactions.length} bank transactions`);

    // 3. Map Bank Transactions to Expense format
    const mappedBankExpenses: ExpenseWithCurrency[] = bankTransactions.map((tx: any) => ({
      _id: tx._id,
      description: tx.merchant_name || tx.description || "Transacción bancaria",
      amount: Math.abs(tx.amount), // Ensure positive amount for display
      date: tx.booking_date,
      category: typeof tx.category === 'object' && tx.category !== null && '_id' in tx.category
        ? (tx.category as any)._id
        : tx.category,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
      // Metadata to identify source
      original_currency: tx.currency,
      original_amount: Math.abs(tx.amount),
      // Custom flag to identify as bank transaction in UI if needed
      is_bank_transaction: true
    }));

    // 4. Merge and Sort descending by date
    let allExpenses = [...manualExpenses, ...mappedBankExpenses];

    // Robust post-fetch filtering to ensure date range is respected
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() : Infinity;

      allExpenses = allExpenses.filter(e => {
        const d = new Date(e.date).getTime();
        return d >= start && d <= end;
      });
    }

    allExpenses.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    console.log("[API] Returning total merged items:", allExpenses.length);

    console.log("[API] Returning total merged items:", allExpenses.length);

    return NextResponse.json({ ok: true, data: allExpenses });
  } catch (err) {
    if (err instanceof AuthError) {
      return unauthorizedResponse();
    }
    console.error("[API ERROR] GET /api/expenses", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// POST - Create new expense (with multi-currency support)
export async function POST(req: Request) {
  try {
    const user = await requireAuth();

    const body = await req.json().catch(() => ({}));
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    console.log("[API] POST /api/expenses - user:", user.id, "Creating expense:", parsed.data);

    const baseCurrency = await getBaseCurrency(user.id);
    const expenseDate = parsed.data.date;

    // Prepare expense data
    const expenseData: Record<string, unknown> = {
      description: parsed.data.description,
      date: new Date(expenseDate),
      category: parsed.data.category,
      user_id: user.id,
    };

    // Handle multi-currency conversion
    if (parsed.data.original_currency && parsed.data.original_amount !== undefined) {
      const originalCurrency = parsed.data.original_currency.toUpperCase();
      const originalAmount = parsed.data.original_amount;

      // If original currency is same as base, no conversion needed
      if (originalCurrency === baseCurrency.currency) {
        expenseData.amount = originalAmount;
        expenseData.original_currency = originalCurrency;
        expenseData.original_amount = originalAmount;
        expenseData.exchange_rate = 1;
        expenseData.base_currency_amount = originalAmount;
      } else {
        // Convert to base currency
        const conversion = await convertCurrency(
          originalAmount,
          originalCurrency,
          baseCurrency.currency,
          expenseDate
        );

        expenseData.amount = conversion.convertedAmount; // Store converted amount as main amount
        expenseData.original_currency = originalCurrency;
        expenseData.original_amount = originalAmount;
        expenseData.exchange_rate = conversion.rate;
        expenseData.base_currency_amount = conversion.convertedAmount;

        console.log(`[API] Currency conversion: ${originalAmount} ${originalCurrency} -> ${conversion.convertedAmount} ${baseCurrency.currency} (rate: ${conversion.rate})`);
      }
    } else {
      // No multi-currency - use amount directly (assume it's in base currency)
      expenseData.amount = parsed.data.amount;
      expenseData.original_currency = baseCurrency.currency;
      expenseData.original_amount = parsed.data.amount;
      expenseData.exchange_rate = 1;
      expenseData.base_currency_amount = parsed.data.amount;
    }

    const result = await totalumSdk.crud.createRecord("expense", expenseData);

    console.log("[API] POST /api/expenses - Created expense:", result.data);
    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    if (err instanceof AuthError) {
      return unauthorizedResponse();
    }
    console.error("[API ERROR] POST /api/expenses", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// PUT - Update expense
export async function PUT(req: Request) {
  try {
    const user = await requireAuth();

    const body = (await req.json().catch(() => ({}))) as { id?: string; description?: string; amount?: number; date?: string; category?: string };
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Expense ID required" }, { status: 400 });
    }

    console.log("[API] PUT /api/expenses - user:", user.id, "Updating expense:", id, data);

    // Verify ownership
    const expenseResult = await totalumSdk.crud.getRecordById<Expense>("expense", id);
    if (!expenseResult.data || (expenseResult.data as Expense & { user_id?: string }).user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Expense not found or access denied" }, { status: 404 });
    }

    // Convert date if present
    const updateData: Record<string, unknown> = { ...data };
    if (data.date) {
      updateData.date = new Date(data.date);
    }

    const result = await totalumSdk.crud.editRecordById("expense", id, updateData);
    console.log("[API] PUT /api/expenses - Updated expense:", result.data);

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    if (err instanceof AuthError) {
      return unauthorizedResponse();
    }
    console.error("[API ERROR] PUT /api/expenses", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// DELETE - Delete expense
export async function DELETE(req: Request) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "Expense ID required" }, { status: 400 });
    }

    console.log("[API] DELETE /api/expenses - user:", user.id, "Deleting expense:", id);

    // Verify ownership
    const expenseResult = await totalumSdk.crud.getRecordById<Expense>("expense", id);
    if (!expenseResult.data || (expenseResult.data as Expense & { user_id?: string }).user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Expense not found or access denied" }, { status: 404 });
    }

    const result = await totalumSdk.crud.deleteRecordById("expense", id);
    console.log("[API] DELETE /api/expenses - Deleted expense");

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    if (err instanceof AuthError) {
      return unauthorizedResponse();
    }
    console.error("[API ERROR] DELETE /api/expenses", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}
