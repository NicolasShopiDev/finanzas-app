import { NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import type { Savings, SavingsMovement } from "@/types/database";

// Helper to serialize errors
function serializeError(err: unknown) {
  const e = err as Record<string, unknown>;
  return {
    message: e?.message ?? "Unknown error",
    code: e?.code ?? null,
    name: e?.name ?? null,
  };
}

// GET - Fetch savings balance and recent movements
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeMovements = searchParams.get("include_movements") === "true";
    const movementsLimit = parseInt(searchParams.get("movements_limit") || "20");

    console.log("[API /savings] GET request:", { includeMovements, movementsLimit });

    // Get savings record (should only be one)
    const savingsResult = await totalumSdk.crud.getRecords<Savings>("savings", {
      pagination: { limit: 1, page: 0 },
    });

    let savings: Savings | null = null;

    if (savingsResult.data && savingsResult.data.length > 0) {
      savings = savingsResult.data[0];
    } else {
      // Create initial savings record if none exists
      const newSavings = await totalumSdk.crud.createRecord("savings", {
        total_balance: 0,
        currency: "EUR",
        last_updated: new Date().toISOString(),
      });
      savings = newSavings.data as Savings;
      console.log("[API /savings] Created initial savings record");
    }

    let movements: SavingsMovement[] = [];
    if (includeMovements && savings) {
      const movementsResult = await totalumSdk.crud.getRecords<SavingsMovement>("savings_movement", {
        filter: [{ savings: savings._id }],
        sort: { date: -1 },
        pagination: { limit: movementsLimit, page: 0 },
      });
      movements = movementsResult.data || [];
    }

    console.log("[API /savings] Fetched savings:", savings?.total_balance, "movements:", movements.length);

    return NextResponse.json({
      ok: true,
      data: {
        savings,
        movements
      }
    });
  } catch (err) {
    console.error("[API /savings] GET error:", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// POST - Create savings movement (transfer to/from budget, withdraw, manual adjustment)
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      movement_type: "entrada" | "salida" | "asignacion_objetivo";
      amount: number;
      description: string;
      source: "transferencia_presupuesto" | "retiro" | "ajuste_manual";
      savings_goal_id?: string;
    };

    console.log("[API /savings] POST request:", body);

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ ok: false, error: "Amount must be positive" }, { status: 400 });
    }

    // Get current savings
    const savingsResult = await totalumSdk.crud.getRecords<Savings>("savings", {
      pagination: { limit: 1, page: 0 },
    });

    if (!savingsResult.data || savingsResult.data.length === 0) {
      return NextResponse.json({ ok: false, error: "No savings record found" }, { status: 404 });
    }

    const savings = savingsResult.data[0];
    const currentBalance = savings.total_balance || 0;

    // Calculate new balance
    let newBalance: number;
    if (body.movement_type === "entrada") {
      newBalance = currentBalance + body.amount;
    } else {
      // For salida and asignacion_objetivo
      if (body.amount > currentBalance) {
        return NextResponse.json({ ok: false, error: "Insufficient savings balance" }, { status: 400 });
      }
      newBalance = currentBalance - body.amount;
    }

    // Create movement record
    const movementData: Record<string, unknown> = {
      movement_type: body.movement_type,
      amount: body.amount,
      date: new Date().toISOString(),
      description: body.description || "",
      source: body.source,
      balance_after: newBalance,
      savings: savings._id,
    };

    if (body.savings_goal_id) {
      movementData.savings_goal = body.savings_goal_id;
    }

    const movementResult = await totalumSdk.crud.createRecord("savings_movement", movementData);
    console.log("[API /savings] Created movement:", movementResult.data);

    // Update savings balance
    await totalumSdk.crud.editRecordById("savings", savings._id, {
      total_balance: newBalance,
      last_updated: new Date().toISOString(),
    });

    // If assigning to a goal, update goal's current amount
    if (body.movement_type === "asignacion_objetivo" && body.savings_goal_id) {
      const goalResult = await totalumSdk.crud.getRecordById("savings_goal", body.savings_goal_id);
      if (goalResult.data) {
        const goal = goalResult.data as { current_amount: number; target_amount: number };
        const newGoalAmount = (goal.current_amount || 0) + body.amount;
        const updates: Record<string, unknown> = { current_amount: newGoalAmount };

        // Mark as completed if target reached
        if (newGoalAmount >= goal.target_amount) {
          updates.status = "completado";
        }

        await totalumSdk.crud.editRecordById("savings_goal", body.savings_goal_id, updates);
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        movement: movementResult.data,
        new_balance: newBalance
      }
    });
  } catch (err) {
    console.error("[API /savings] POST error:", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}
