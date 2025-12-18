import { NextResponse } from "next/server";
import { z } from "zod";
import { totalumSdk } from "@/lib/totalum";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/auth-utils";
import type { MonthlyBudget } from "@/types/database";

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

const createBudgetSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
  total_budget: z.number().min(0),
});

// GET - Get budget for current month or by query params
export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    console.log("[API] GET /api/budget - user:", user.id, "month:", month, "year:", year);

    const filterArray: Record<string, unknown>[] = [{ user_id: user.id }];
    if (month) filterArray.push({ month: parseInt(month) });
    if (year) filterArray.push({ year: parseInt(year) });

    const result = await totalumSdk.crud.getRecords<MonthlyBudget>("monthly_budget", {
      filter: filterArray,
    });
    console.log("[API] GET /api/budget - result:", JSON.stringify(result.data));

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    console.error("[API ERROR] GET /api/budget", err);
    if (err instanceof AuthError) {
      return NextResponse.json(unauthorizedResponse(), { status: 401 });
    }
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// POST - Create new budget
export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = createBudgetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    console.log("[API] POST /api/budget - user:", user.id, "Creating budget:", parsed.data);

    // Check if budget already exists for this month/year for this user
    const existingResult = await totalumSdk.crud.getRecords<MonthlyBudget>("monthly_budget", {
      filter: [
        { user_id: user.id },
        { month: parsed.data.month },
        { year: parsed.data.year },
      ],
    });

    if (existingResult.data && existingResult.data.length > 0) {
      // Update existing budget
      const existingId = existingResult.data[0]._id;
      const updateResult = await totalumSdk.crud.editRecordById("monthly_budget", existingId, {
        total_budget: parsed.data.total_budget,
      });
      console.log("[API] POST /api/budget - Updated existing budget:", updateResult.data);
      return NextResponse.json({ ok: true, data: updateResult.data });
    }

    const result = await totalumSdk.crud.createRecord("monthly_budget", {
      month: parsed.data.month,
      year: parsed.data.year,
      total_budget: parsed.data.total_budget,
      user_id: user.id,
    });

    console.log("[API] POST /api/budget - Created budget:", result.data);
    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    console.error("[API ERROR] POST /api/budget", err);
    if (err instanceof AuthError) {
      return NextResponse.json(unauthorizedResponse(), { status: 401 });
    }
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// PUT - Update budget
export async function PUT(req: Request) {
  try {
    const user = await requireAuth();
    const body = (await req.json().catch(() => ({}))) as { id?: string; total_budget?: number };
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Budget ID required" }, { status: 400 });
    }

    console.log("[API] PUT /api/budget - user:", user.id, "Updating budget:", id, data);

    // Verify the budget belongs to this user
    const existingResult = await totalumSdk.crud.getRecordById<MonthlyBudget>("monthly_budget", id);
    if (!existingResult.data || (existingResult.data as MonthlyBudget & { user_id?: string }).user_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Budget not found" }, { status: 404 });
    }

    const result = await totalumSdk.crud.editRecordById("monthly_budget", id, data);
    console.log("[API] PUT /api/budget - Updated budget:", result.data);

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    console.error("[API ERROR] PUT /api/budget", err);
    if (err instanceof AuthError) {
      return NextResponse.json(unauthorizedResponse(), { status: 401 });
    }
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}
