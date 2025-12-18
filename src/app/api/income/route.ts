import { NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/auth-utils";
import type { Income, DistributionRule } from "@/types/database";

// Helper to serialize errors
function serializeError(err: unknown) {
  if (err instanceof AuthError) {
    return { message: err.message, code: "UNAUTHORIZED", name: err.name };
  }
  const e = err as Record<string, unknown>;
  return {
    message: e?.message ?? "Unknown error",
    code: e?.code ?? null,
    name: e?.name ?? null,
  };
}

// GET - Fetch incomes with optional filters
export async function GET(req: Request) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const status = searchParams.get("status");

    console.log("[API /income] GET request - user:", user.id, "params:", { month, year, status });

    const filter: Record<string, unknown>[] = [{ user_id: user.id }];

    if (month) {
      filter.push({ month: parseInt(month) });
    }
    if (year) {
      filter.push({ year: parseInt(year) });
    }
    if (status) {
      filter.push({ status });
    }

    const result = await totalumSdk.crud.getRecords<Income>("income", {
      filter,
      sort: { date: -1 },
      pagination: { limit: 100, page: 0 },
    });

    console.log("[API /income] Fetched incomes:", result.data?.length || 0);

    return NextResponse.json({ ok: true, data: result.data || [] });
  } catch (err) {
    if (err instanceof AuthError) {
      return unauthorizedResponse();
    }
    console.error("[API /income] GET error:", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// POST - Create new income and optionally distribute
export async function POST(req: Request) {
  try {
    const user = await requireAuth();

    const body = (await req.json()) as Partial<Income> & { auto_distribute?: boolean };
    console.log("[API /income] POST request - user:", user.id, body);

    // Set defaults
    const incomeDate = new Date(body.date || new Date());
    const incomeData: Record<string, unknown> = {
      description: body.description || "",
      amount: body.amount || 0,
      currency: body.currency || "EUR",
      date: incomeDate.toISOString(),
      origin: body.origin || "manual",
      income_type: body.income_type || "puntual",
      status: body.status || "confirmado",
      source_name: body.source_name || "",
      bank_reference: body.bank_reference || "",
      month: body.month || incomeDate.getMonth() + 1,
      year: body.year || incomeDate.getFullYear(),
      distributed_to_budget: 0,
      distributed_to_savings: 0,
      distributed_to_free: 0,
      is_distributed: "no",
      user_id: user.id,
    };

    // Create income record
    const result = await totalumSdk.crud.createRecord("income", incomeData);
    console.log("[API /income] Created income:", result.data?._id);

    const createdIncome = result.data as Income;

    // Auto-distribute if requested and income is confirmed (not internal transfer)
    if (body.auto_distribute !== false &&
        incomeData.status === "confirmado" &&
        incomeData.income_type !== "transferencia_interna") {
      await distributeIncome(createdIncome._id, body.amount || 0, user.id);
    }

    return NextResponse.json({ ok: true, data: createdIncome });
  } catch (err) {
    if (err instanceof AuthError) {
      return unauthorizedResponse();
    }
    console.error("[API /income] POST error:", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// PUT - Update income
export async function PUT(req: Request) {
  try {
    const user = await requireAuth();

    const body = (await req.json()) as Partial<Income> & { id: string };
    console.log("[API /income] PUT request - user:", user.id, body);

    if (!body.id) {
      return NextResponse.json({ ok: false, error: "Missing income ID" }, { status: 400 });
    }

    // Verify ownership
    const incomeResult = await totalumSdk.crud.getRecordById<Income>("income", body.id);
    if (!incomeResult.data || (incomeResult.data as Income & { user_id?: string }).user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Income not found or access denied" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.description !== undefined) updates.description = body.description;
    if (body.amount !== undefined) updates.amount = body.amount;
    if (body.currency !== undefined) updates.currency = body.currency;
    if (body.date !== undefined) updates.date = body.date;
    if (body.income_type !== undefined) updates.income_type = body.income_type;
    if (body.status !== undefined) updates.status = body.status;
    if (body.source_name !== undefined) updates.source_name = body.source_name;

    const result = await totalumSdk.crud.editRecordById("income", body.id, updates);
    console.log("[API /income] Updated income:", body.id);

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    if (err instanceof AuthError) {
      return unauthorizedResponse();
    }
    console.error("[API /income] PUT error:", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// DELETE - Remove income
export async function DELETE(req: Request) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing income ID" }, { status: 400 });
    }

    console.log("[API /income] DELETE request - user:", user.id, id);

    // Verify ownership
    const incomeResult = await totalumSdk.crud.getRecordById<Income>("income", id);
    if (!incomeResult.data || (incomeResult.data as Income & { user_id?: string }).user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Income not found or access denied" }, { status: 404 });
    }

    await totalumSdk.crud.deleteRecordById("income", id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return unauthorizedResponse();
    }
    console.error("[API /income] DELETE error:", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// Helper function to distribute income according to active rule
async function distributeIncome(incomeId: string, amount: number, userId: string) {
  try {
    console.log("[API /income] Distributing income:", incomeId, amount, "user:", userId);

    // Get active distribution rule for this user
    const rulesResult = await totalumSdk.crud.getRecords<DistributionRule>("distribution_rule", {
      filter: [{ user_id: userId }, { is_active: "si" }],
      pagination: { limit: 1, page: 0 },
    });

    // Default rule if none exists: 80% budget, 20% savings, 0% free
    const rule = rulesResult.data?.[0] || {
      budget_percentage: 80,
      savings_percentage: 20,
      free_percentage: 0,
    };

    const toBudget = Math.round((amount * rule.budget_percentage) / 100 * 100) / 100;
    const toSavings = Math.round((amount * rule.savings_percentage) / 100 * 100) / 100;
    const toFree = Math.round((amount * rule.free_percentage) / 100 * 100) / 100;

    console.log("[API /income] Distribution:", { toBudget, toSavings, toFree });

    // Update income with distribution
    await totalumSdk.crud.editRecordById("income", incomeId, {
      distributed_to_budget: toBudget,
      distributed_to_savings: toSavings,
      distributed_to_free: toFree,
      is_distributed: "si",
    });

    // Add savings movement if any goes to savings
    if (toSavings > 0) {
      await addSavingsMovement(toSavings, incomeId, "Distribución automática de ingreso", userId);
    }

    console.log("[API /income] Income distributed successfully");
  } catch (err) {
    console.error("[API /income] Error distributing income:", err);
  }
}

// Helper to add savings movement and update savings balance
async function addSavingsMovement(amount: number, incomeId: string, description: string, userId: string) {
  try {
    // Get or create savings record for this user
    const savingsResult = await totalumSdk.crud.getRecords("savings", {
      filter: [{ user_id: userId }],
      pagination: { limit: 1, page: 0 },
    });

    let savingsId: string;
    let currentBalance = 0;

    if (savingsResult.data && savingsResult.data.length > 0) {
      const savings = savingsResult.data[0] as { _id: string; total_balance: number };
      savingsId = savings._id;
      currentBalance = savings.total_balance || 0;
    } else {
      // Create savings record
      const newSavings = await totalumSdk.crud.createRecord("savings", {
        total_balance: 0,
        currency: "EUR",
        last_updated: new Date().toISOString(),
        user_id: userId,
      });
      savingsId = (newSavings.data as { _id: string })._id;
    }

    const newBalance = currentBalance + amount;

    // Create savings movement
    await totalumSdk.crud.createRecord("savings_movement", {
      movement_type: "entrada",
      amount: amount,
      date: new Date().toISOString(),
      description: description,
      source: "ingreso_automatico",
      balance_after: newBalance,
      savings: savingsId,
      income: incomeId,
      user_id: userId,
    });

    // Update savings balance
    await totalumSdk.crud.editRecordById("savings", savingsId, {
      total_balance: newBalance,
      last_updated: new Date().toISOString(),
    });

    console.log("[API /income] Savings movement created, new balance:", newBalance);
  } catch (err) {
    console.error("[API /income] Error adding savings movement:", err);
  }
}
