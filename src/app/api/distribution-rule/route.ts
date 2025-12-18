import { NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/auth-utils";
import type { DistributionRule } from "@/types/database";

// Helper to serialize errors
function serializeError(err: unknown) {
  const e = err as Record<string, unknown>;
  return {
    message: e?.message ?? "Unknown error",
    code: e?.code ?? null,
    name: e?.name ?? null,
  };
}

// GET - Fetch active distribution rule
export async function GET() {
  try {
    const user = await requireAuth();
    console.log("[API /distribution-rule] GET request for user:", user.id);

    // Get active rule
    const result = await totalumSdk.crud.getRecords<DistributionRule>("distribution_rule", {
      filter: [{ is_active: "si", user_id: user.id }],
      sort: { effective_from: -1 },
      pagination: { limit: 1, page: 0 },
    });

    let rule: DistributionRule | null = null;

    if (result.data && result.data.length > 0) {
      rule = result.data[0];
    } else {
      // Create default rule if none exists (80/20/0)
      const newRule = await totalumSdk.crud.createRecord("distribution_rule", {
        budget_percentage: 80,
        savings_percentage: 20,
        free_percentage: 0,
        is_active: "si",
        effective_from: new Date().toISOString(),
        user_id: user.id
      });
      rule = newRule.data as DistributionRule;
      console.log("[API /distribution-rule] Created default rule");
    }

    console.log("[API /distribution-rule] Active rule:", rule?.budget_percentage, "/", rule?.savings_percentage, "/", rule?.free_percentage);

    return NextResponse.json({ ok: true, data: rule });
  } catch (err) {
    if (err instanceof AuthError) {
      return unauthorizedResponse();
    }
    console.error("[API /distribution-rule] GET error:", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// PUT - Update distribution rule
export async function PUT(req: Request) {
  try {
    const user = await requireAuth();
    const body = (await req.json()) as {
      budget_percentage: number;
      savings_percentage: number;
      free_percentage: number;
    };

    console.log("[API /distribution-rule] PUT request for user:", user.id, body);

    // Validate percentages sum to 100
    const total = body.budget_percentage + body.savings_percentage + body.free_percentage;
    if (Math.abs(total - 100) > 0.01) {
      return NextResponse.json({
        ok: false,
        error: `Percentages must sum to 100% (currently: ${total}%)`
      }, { status: 400 });
    }

    // Validate no negative percentages
    if (body.budget_percentage < 0 || body.savings_percentage < 0 || body.free_percentage < 0) {
      return NextResponse.json({
        ok: false,
        error: "Percentages cannot be negative"
      }, { status: 400 });
    }

    // Get current active rule
    const currentResult = await totalumSdk.crud.getRecords<DistributionRule>("distribution_rule", {
      filter: [{ is_active: "si", user_id: user.id }],
      pagination: { limit: 1, page: 0 },
    });

    if (currentResult.data && currentResult.data.length > 0) {
      // Deactivate current rule
      await totalumSdk.crud.editRecordById("distribution_rule", currentResult.data[0]._id, {
        is_active: "no",
      });
    }

    // Create new active rule (keeping history)
    const newRule = await totalumSdk.crud.createRecord("distribution_rule", {
      budget_percentage: body.budget_percentage,
      savings_percentage: body.savings_percentage,
      free_percentage: body.free_percentage,
      is_active: "si",
      effective_from: new Date().toISOString(),
      user_id: user.id
    });

    console.log("[API /distribution-rule] Updated rule:", newRule.data);

    return NextResponse.json({ ok: true, data: newRule.data });
  } catch (err) {
    if (err instanceof AuthError) {
      return unauthorizedResponse();
    }
    console.error("[API /distribution-rule] PUT error:", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// GET history of all rules
export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = (await req.json()) as { action: string };

    if (body.action === "history") {
      console.log("[API /distribution-rule] Fetching rule history for user:", user.id);

      const result = await totalumSdk.crud.getRecords<DistributionRule>("distribution_rule", {
        filter: [{ user_id: user.id }],
        sort: { effective_from: -1 },
        pagination: { limit: 50, page: 0 },
      });

      return NextResponse.json({ ok: true, data: result.data || [] });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthError) {
      return unauthorizedResponse();
    }
    console.error("[API /distribution-rule] POST error:", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}
