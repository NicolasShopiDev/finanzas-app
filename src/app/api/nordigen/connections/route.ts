// API route for managing bank connections
import { NextRequest, NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import { BankConnection } from "@/types/database";

// GET - Fetch all bank connections
export async function GET() {
  try {
    console.log("[Bank Connections] Fetching all connections...");

    const result = await totalumSdk.crud.getRecords<BankConnection>("bank_connection", {
      sort: { createdAt: -1 },
      pagination: { limit: 50, page: 0 }
    });

    if (result.errors) {
      console.error("[Bank Connections] Error:", result.errors);
      return NextResponse.json({ ok: false, error: result.errors }, { status: 500 });
    }

    console.log(`[Bank Connections] Found ${result.data?.length || 0} connections`);

    return NextResponse.json({
      ok: true,
      data: result.data || []
    });
  } catch (error) {
    console.error("[Bank Connections] Error:", error);
    return NextResponse.json({ ok: false, error: "Error fetching connections" }, { status: 500 });
  }
}

// DELETE - Remove a bank connection
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("id");

    if (!connectionId) {
      return NextResponse.json({ ok: false, error: "Connection ID is required" }, { status: 400 });
    }

    console.log(`[Bank Connections] Deleting connection: ${connectionId}`);

    // Delete associated transactions first
    const transactionsResult = await totalumSdk.crud.getRecords("bank_transaction", {
      filter: [{ bank_connection: connectionId }],
      pagination: { limit: 1000, page: 0 }
    });

    if (transactionsResult.data && transactionsResult.data.length > 0) {
      console.log(`[Bank Connections] Deleting ${transactionsResult.data.length} associated transactions`);
      for (const tx of transactionsResult.data) {
        await totalumSdk.crud.deleteRecordById("bank_transaction", (tx as { _id: string })._id);
      }
    }

    // Delete the connection
    await totalumSdk.crud.deleteRecordById("bank_connection", connectionId);

    console.log("[Bank Connections] Connection deleted successfully");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Bank Connections] Error deleting:", error);
    return NextResponse.json({ ok: false, error: "Error deleting connection" }, { status: 500 });
  }
}
