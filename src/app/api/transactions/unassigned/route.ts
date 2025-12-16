// API route for managing unassigned bank transactions
import { NextRequest, NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import { BankTransaction, Category } from "@/types/database";

// GET: Fetch all unassigned transactions (no category assigned)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "0");

    console.log("[Unassigned Transactions] Fetching unassigned transactions...");

    // Fetch transactions where category is null/empty or is_processed is "no"
    const result = await totalumSdk.crud.getRecords<BankTransaction>("bank_transaction", {
      filter: [
        {
          or: [
            { is_processed: "no" },
            { category: { ne: "" } } // This won't work for null, we'll filter in code
          ]
        }
      ],
      sort: { booking_date: -1 },
      pagination: { limit, page }
    });

    // Filter to only include transactions without a category
    const transactions = (result.data || []).filter(tx => {
      // If category is null, undefined, empty string, or is_processed is "no"
      return !tx.category || tx.is_processed === "no";
    });

    console.log(`[Unassigned Transactions] Found ${transactions.length} unassigned transactions`);

    // Fetch categories for the dropdown
    const categoriesResult = await totalumSdk.crud.getRecords<Category>("category", {
      sort: { name: 1 },
      pagination: { limit: 100, page: 0 }
    });

    return NextResponse.json({
      ok: true,
      data: {
        transactions,
        categories: categoriesResult.data || [],
        total: transactions.length
      }
    });
  } catch (error) {
    console.error("[Unassigned Transactions] Error fetching:", error);
    return NextResponse.json(
      { ok: false, error: "Error al obtener transacciones sin asignar" },
      { status: 500 }
    );
  }
}

// PUT: Assign category to a transaction
export async function PUT(request: NextRequest) {
  try {
    const body: { transaction_id?: string; category_id?: string | null } = await request.json();
    const { transaction_id, category_id } = body;

    if (!transaction_id) {
      return NextResponse.json(
        { ok: false, error: "ID de transacción requerido" },
        { status: 400 }
      );
    }

    console.log(`[Unassigned Transactions] Assigning category ${category_id} to transaction ${transaction_id}`);

    // Update the transaction with the category and mark as processed
    const updateData: Record<string, string> = {
      is_processed: "si"
    };

    if (category_id) {
      updateData.category = category_id;
    }

    await totalumSdk.crud.editRecordById("bank_transaction", transaction_id, updateData);

    console.log(`[Unassigned Transactions] Transaction ${transaction_id} updated successfully`);

    return NextResponse.json({
      ok: true,
      data: { message: "Transacción actualizada correctamente" }
    });
  } catch (error) {
    console.error("[Unassigned Transactions] Error updating:", error);
    return NextResponse.json(
      { ok: false, error: "Error al actualizar la transacción" },
      { status: 500 }
    );
  }
}

// POST: Bulk assign categories to multiple transactions
interface BulkAssignment {
  transaction_id: string;
  category_id?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: { assignments?: BulkAssignment[] } = await request.json();
    const { assignments } = body;

    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Se requiere un array de asignaciones" },
        { status: 400 }
      );
    }

    console.log(`[Unassigned Transactions] Bulk assigning ${assignments.length} transactions`);

    let successCount = 0;
    let errorCount = 0;

    for (const assignment of assignments) {
      try {
        const updateData: Record<string, string> = {
          is_processed: "si"
        };

        if (assignment.category_id) {
          updateData.category = assignment.category_id;
        }

        await totalumSdk.crud.editRecordById("bank_transaction", assignment.transaction_id, updateData);
        successCount++;
      } catch (err) {
        console.error(`[Unassigned Transactions] Error updating transaction ${assignment.transaction_id}:`, err);
        errorCount++;
      }
    }

    console.log(`[Unassigned Transactions] Bulk update complete: ${successCount} success, ${errorCount} errors`);

    return NextResponse.json({
      ok: true,
      data: {
        successCount,
        errorCount,
        message: `${successCount} transacciones actualizadas correctamente`
      }
    });
  } catch (error) {
    console.error("[Unassigned Transactions] Error in bulk update:", error);
    return NextResponse.json(
      { ok: false, error: "Error al actualizar las transacciones" },
      { status: 500 }
    );
  }
}
