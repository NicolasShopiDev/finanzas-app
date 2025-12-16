import { NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import type { SavingsGoal, Savings } from "@/types/database";

// Helper to serialize errors
function serializeError(err: unknown) {
  const e = err as Record<string, unknown>;
  return {
    message: e?.message ?? "Unknown error",
    code: e?.code ?? null,
    name: e?.name ?? null,
  };
}

// GET - Fetch all savings goals
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // active, paused, completed, or all

    console.log("[API /savings-goals] GET request:", { status });

    const filter: Record<string, unknown>[] = [];

    if (status && status !== "all") {
      filter.push({ status: status === "active" ? "activo" : status === "paused" ? "pausado" : "completado" });
    }

    const result = await totalumSdk.crud.getRecords<SavingsGoal>("savings_goal", {
      filter: filter.length > 0 ? filter : undefined,
      sort: { priority: 1 }, // alta first
      pagination: { limit: 50, page: 0 },
    });

    console.log("[API /savings-goals] Fetched goals:", result.data?.length || 0);

    return NextResponse.json({ ok: true, data: result.data || [] });
  } catch (err) {
    console.error("[API /savings-goals] GET error:", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// POST - Create new savings goal
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<SavingsGoal>;
    console.log("[API /savings-goals] POST request:", body);

    if (!body.name || !body.target_amount) {
      return NextResponse.json({ ok: false, error: "Name and target amount are required" }, { status: 400 });
    }

    // Get savings record for linking
    const savingsResult = await totalumSdk.crud.getRecords<Savings>("savings", {
      pagination: { limit: 1, page: 0 },
    });

    let savingsId: string | null = null;
    if (savingsResult.data && savingsResult.data.length > 0) {
      savingsId = savingsResult.data[0]._id;
    }

    const goalData: Record<string, unknown> = {
      name: body.name,
      target_amount: body.target_amount,
      current_amount: body.current_amount || 0,
      priority: body.priority || "media",
      status: body.status || "activo",
      icon: body.icon || "🎯",
      target_date: body.target_date || null,
      notes: body.notes || "",
    };

    if (savingsId) {
      goalData.savings = savingsId;
    }

    const result = await totalumSdk.crud.createRecord("savings_goal", goalData);
    console.log("[API /savings-goals] Created goal:", result.data);

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    console.error("[API /savings-goals] POST error:", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// PUT - Update savings goal
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as Partial<SavingsGoal> & { id: string };
    console.log("[API /savings-goals] PUT request:", body);

    if (!body.id) {
      return NextResponse.json({ ok: false, error: "Missing goal ID" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.target_amount !== undefined) updates.target_amount = body.target_amount;
    if (body.current_amount !== undefined) updates.current_amount = body.current_amount;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.status !== undefined) updates.status = body.status;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.target_date !== undefined) updates.target_date = body.target_date;
    if (body.notes !== undefined) updates.notes = body.notes;

    const result = await totalumSdk.crud.editRecordById("savings_goal", body.id, updates);
    console.log("[API /savings-goals] Updated goal:", body.id);

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    console.error("[API /savings-goals] PUT error:", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// DELETE - Remove savings goal
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing goal ID" }, { status: 400 });
    }

    console.log("[API /savings-goals] DELETE request:", id);

    // Get goal first to return its amount to available savings
    const goalResult = await totalumSdk.crud.getRecordById<SavingsGoal>("savings_goal", id);

    if (goalResult.data && goalResult.data.current_amount > 0) {
      // The assigned amount returns to available savings (no movement needed,
      // as it was never "locked" - just a logical assignment)
      console.log("[API /savings-goals] Goal had", goalResult.data.current_amount, "assigned - releasing");
    }

    await totalumSdk.crud.deleteRecordById("savings_goal", id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API /savings-goals] DELETE error:", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}
