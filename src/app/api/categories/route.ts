import { NextResponse } from "next/server";
import { z } from "zod";
import { totalumSdk } from "@/lib/totalum";
import type { Category, CategoryNameHistoryEntry } from "@/types/database";

function serializeError(err: unknown) {
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

const createCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["fija", "variable"]),
  percentage: z.number().min(0).max(100).optional(),
  fixed_amount: z.number().min(0).optional(),
  icon: z.string().min(1),
});

// Helper to parse name_history from string to array
function parseNameHistory(nameHistory: string | CategoryNameHistoryEntry[] | null | undefined): CategoryNameHistoryEntry[] {
  if (!nameHistory) return [];
  if (Array.isArray(nameHistory)) return nameHistory;
  try {
    return JSON.parse(nameHistory) as CategoryNameHistoryEntry[];
  } catch {
    return [];
  }
}

// Helper to get the category name at a specific date
function getCategoryNameAtDate(category: Category, targetDate: Date): string {
  const history = parseNameHistory(category.name_history);
  if (history.length === 0) return category.name;

  // Sort history by date descending
  const sortedHistory = [...history].sort((a, b) =>
    new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  );

  // Find the name that was active at the target date
  for (const entry of sortedHistory) {
    if (new Date(entry.changed_at) <= targetDate) {
      return entry.name;
    }
  }

  // If no entry found, return the oldest name or current name
  return sortedHistory[sortedHistory.length - 1]?.name || category.name;
}

// GET - Get all categories (global, with filtering options)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active_only") === "true";
    const includeDeleted = searchParams.get("include_deleted") === "true";
    const forMonth = searchParams.get("for_month"); // Format: YYYY-MM
    const withExpenses = searchParams.get("with_expenses") === "true"; // Include categories that had expenses in the specified month

    // Legacy support: budget_id parameter (now ignored, categories are global)
    const budgetId = searchParams.get("budget_id");

    console.log("[API] GET /api/categories - activeOnly:", activeOnly, "includeDeleted:", includeDeleted, "forMonth:", forMonth, "budgetId:", budgetId);

    // Build filter - categories are now global
    const filter: { filter?: Array<Record<string, unknown>> } = {};

    if (activeOnly && !includeDeleted) {
      // Only get active categories
      filter.filter = [{ is_active: "si" }];
    } else if (!includeDeleted) {
      // By default, get active categories OR categories without is_active set (legacy data)
      // We fetch all and filter in code to handle null/undefined is_active
    }

    const result = await totalumSdk.crud.getRecords<Category>("category", filter);
    let categories = result.data || [];

    // Filter out deleted categories unless explicitly requested
    if (!includeDeleted) {
      categories = categories.filter(cat => cat.is_active === "si" || cat.is_active === undefined || cat.is_active === null);
    }

    // If forMonth is specified, we need special handling for deleted categories
    // that had expenses in that month
    if (forMonth && withExpenses) {
      const [year, month] = forMonth.split("-").map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);

      // Get all expenses for this month to find which categories were used
      const expensesResult = await totalumSdk.crud.getRecords("expense", {
        filter: [{
          date: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }]
      }) as { data?: Array<{ category?: string }> };

      const usedCategoryIds = new Set((expensesResult.data || []).map(e => e.category).filter(Boolean));

      // If there are used categories that are now deleted, we need to include them
      if (usedCategoryIds.size > 0) {
        const allCategoriesResult = await totalumSdk.crud.getRecords<Category>("category", {});
        const allCategories = allCategoriesResult.data || [];

        // Add deleted categories that were used in this month
        for (const cat of allCategories) {
          if (usedCategoryIds.has(cat._id) && !categories.find(c => c._id === cat._id)) {
            // Check if category was deleted after this month
            if (cat.deleted_at) {
              const deletedDate = new Date(cat.deleted_at);
              if (deletedDate > endOfMonth) {
                // Category was deleted after this month, include it
                categories.push(cat);
              }
            } else {
              // Category is active, should already be in the list
              if (!categories.find(c => c._id === cat._id)) {
                categories.push(cat);
              }
            }
          }
        }
      }
    }

    // If forMonth is specified, adjust category names based on history
    if (forMonth) {
      const [year, month] = forMonth.split("-").map(Number);
      const targetDate = new Date(year, month - 1, 15); // Middle of the month

      categories = categories.map(cat => ({
        ...cat,
        // Override name with historical name if viewing past month
        name: getCategoryNameAtDate(cat, targetDate),
        // Include parsed name_history for frontend use
        name_history: parseNameHistory(cat.name_history)
      }));
    }

    console.log("[API] GET /api/categories - result count:", categories.length);

    return NextResponse.json({ ok: true, data: categories });
  } catch (err) {
    console.error("[API ERROR] GET /api/categories", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// POST - Create new category (global, not tied to a specific month)
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    console.log("[API] POST /api/categories - Creating category:", parsed.data);

    const now = new Date().toISOString();
    const initialNameHistory: CategoryNameHistoryEntry[] = [{
      name: parsed.data.name,
      changed_at: now
    }];

    const categoryData: Record<string, unknown> = {
      name: parsed.data.name,
      type: parsed.data.type,
      icon: parsed.data.icon,
      percentage: parsed.data.percentage || 0,
      fixed_amount: parsed.data.fixed_amount || 0,
      is_active: "si",
      name_history: JSON.stringify(initialNameHistory),
    };

    const result = await totalumSdk.crud.createRecord("category", categoryData);
    console.log("[API] POST /api/categories - Created category:", result.data);

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    console.error("[API ERROR] POST /api/categories", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// PUT - Update category (with special handling for name changes)
export async function PUT(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
      type?: string;
      percentage?: number;
      fixed_amount?: number;
      icon?: string;
      is_active?: "si" | "no";
    };
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Category ID required" }, { status: 400 });
    }

    console.log("[API] PUT /api/categories - Updating category:", id, data);

    // If name is being changed, update name_history
    if (data.name) {
      // Get current category to check if name is actually changing
      const currentResult = await totalumSdk.crud.getRecordById<Category>("category", id);
      const currentCategory = currentResult.data;

      if (currentCategory && currentCategory.name !== data.name) {
        // Name is changing - add to history
        const currentHistory = parseNameHistory(currentCategory.name_history);
        const now = new Date().toISOString();

        currentHistory.push({
          name: data.name,
          changed_at: now
        });

        (data as Record<string, unknown>).name_history = JSON.stringify(currentHistory);
        console.log("[API] PUT /api/categories - Name changed, updated history");
      }
    }

    const result = await totalumSdk.crud.editRecordById("category", id, data);
    console.log("[API] PUT /api/categories - Updated category:", result.data);

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    console.error("[API ERROR] PUT /api/categories", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// DELETE - Soft delete category (deactivate, don't actually delete)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const hardDelete = searchParams.get("hard") === "true"; // For truly removing (admin use)

    if (!id) {
      return NextResponse.json({ ok: false, error: "Category ID required" }, { status: 400 });
    }

    console.log("[API] DELETE /api/categories - Deleting category:", id, "hardDelete:", hardDelete);

    if (hardDelete) {
      // Actually delete the record (use with caution)
      const result = await totalumSdk.crud.deleteRecordById("category", id);
      console.log("[API] DELETE /api/categories - Hard deleted category");
      return NextResponse.json({ ok: true, data: result.data });
    }

    // Soft delete - just mark as inactive
    const now = new Date().toISOString();
    const result = await totalumSdk.crud.editRecordById("category", id, {
      is_active: "no",
      deleted_at: now
    });
    console.log("[API] DELETE /api/categories - Soft deleted category");

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    console.error("[API ERROR] DELETE /api/categories", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// PATCH - Reactivate a deleted category
export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const { id } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Category ID required" }, { status: 400 });
    }

    console.log("[API] PATCH /api/categories - Reactivating category:", id);

    const result = await totalumSdk.crud.editRecordById("category", id, {
      is_active: "si",
      deleted_at: null
    });
    console.log("[API] PATCH /api/categories - Reactivated category:", result.data);

    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    console.error("[API ERROR] PATCH /api/categories", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}
