import { NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/auth-utils";
import type { MonthlyBudget, Category, Expense } from "@/types/database";

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

interface NestedQuery {
  [key: string]: {
    tableFilter?: {
      filter?: Record<string, unknown>[];
      sort?: Record<string, number>;
      pagination?: { limit: number; page: number };
    };
    [nestedTable: string]: unknown;
  };
}

// GET - Get statistics data
export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") || new Date().getFullYear().toString();

    console.log("[API] GET /api/statistics - year:", year, "user:", user.id);

    // Get all budgets for the year
    const budgetsResult = await totalumSdk.crud.getRecords<MonthlyBudget>("monthly_budget", {
      filter: [{ year: parseInt(year), user_id: user.id }],
      sort: { month: 1 },
    });
    console.log("[API] Statistics - budgets found:", budgetsResult.data?.length);

    // Get all categories
    const categoriesResult = await totalumSdk.crud.getRecords<Category>("category", {
      filter: [{ user_id: user.id }],
    });
    console.log("[API] Statistics - categories found:", categoriesResult.data?.length);

    // Get all expenses for the year
    const startOfYear = new Date(parseInt(year), 0, 1);
    const endOfYear = new Date(parseInt(year), 11, 31, 23, 59, 59);

    const expensesResult = await totalumSdk.crud.getRecords<Expense>("expense", {
      filter: [
        { date: { gte: startOfYear } },
        { date: { lte: endOfYear } },
        { user_id: user.id },
      ],
      pagination: { limit: 1000, page: 0 },
    });
    console.log("[API] Statistics - expenses found:", expensesResult.data?.length);

    const budgets = budgetsResult.data || [];
    const categories = categoriesResult.data || [];
    const expenses = expensesResult.data || [];

    // Calculate statistics
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const budget = budgets.find(b => b.month === month);
      const monthExpenses = expenses.filter(e => {
        const expDate = new Date(e.date);
        return expDate.getMonth() + 1 === month;
      });
      const totalSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

      return {
        month,
        monthName: new Date(parseInt(year), i).toLocaleString('es-ES', { month: 'short' }),
        budget: budget?.total_budget || 0,
        spent: totalSpent,
        savings: (budget?.total_budget || 0) - totalSpent,
      };
    });

    // Category breakdown
    const categoryBreakdown = categories.map(cat => {
      const catExpenses = expenses.filter(e => e.category === cat._id);
      const totalSpent = catExpenses.reduce((sum, e) => sum + e.amount, 0);
      return {
        id: cat._id,
        name: cat.name,
        icon: cat.icon,
        type: cat.type,
        totalSpent,
        expenseCount: catExpenses.length,
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent);

    // Totals
    const totalBudget = budgets.reduce((sum, b) => sum + b.total_budget, 0);
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const avgMonthlySpent = totalSpent / (budgets.length || 1);
    const totalExpenses = expenses.length;

    // Fixed vs Variable spending
    const fixedCategories = categories.filter(c => c.type === "fija");
    const variableCategories = categories.filter(c => c.type === "variable");

    const fixedSpent = expenses
      .filter(e => fixedCategories.some(c => c._id === e.category))
      .reduce((sum, e) => sum + e.amount, 0);

    const variableSpent = expenses
      .filter(e => variableCategories.some(c => c._id === e.category))
      .reduce((sum, e) => sum + e.amount, 0);

    const statistics = {
      year: parseInt(year),
      monthlyData,
      categoryBreakdown,
      totals: {
        totalBudget,
        totalSpent,
        totalSavings: totalBudget - totalSpent,
        avgMonthlySpent,
        totalExpenses,
      },
      spendingByType: {
        fixed: fixedSpent,
        variable: variableSpent,
      },
    };

    console.log("[API] Statistics calculated successfully");
    return NextResponse.json({ ok: true, data: statistics });
  } catch (err) {
    if (err instanceof AuthError) {
      return unauthorizedResponse();
    }
    console.error("[API ERROR] GET /api/statistics", err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}
