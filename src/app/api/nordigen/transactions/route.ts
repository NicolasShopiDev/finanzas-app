// API route for fetching and syncing bank transactions
import { NextRequest, NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import { convertCurrency } from "@/lib/exchange-rate";
import { NordigenConfig, BankConnection, BankTransaction, NordigenTokenResponse, NordigenTransactionsResponse, NordigenErrorResponse, NordigenTransaction, UserSettings } from "@/types/database";

// Helper to get user's base currency
async function getBaseCurrency(): Promise<{ currency: string; symbol: string }> {
  try {
    const result = await totalumSdk.crud.getRecords<UserSettings>('user_settings', {
      pagination: { limit: 1, page: 0 },
    });
    if (result.data && result.data.length > 0) {
      return {
        currency: result.data[0].base_currency.toUpperCase(),
        symbol: result.data[0].base_currency_symbol,
      };
    }
  } catch (error) {
    console.error('[Nordigen] Error getting base currency:', error);
  }
  return { currency: 'EUR', symbol: '€' };
}

// Helper to get valid access token
async function getValidAccessToken(): Promise<string | null> {
  try {
    const result = await totalumSdk.crud.getRecords<NordigenConfig>("nordigen_config", {
      pagination: { limit: 1, page: 0 }
    });

    if (!result.data || result.data.length === 0) return null;

    const config = result.data[0];
    const now = new Date();
    const tokenExpires = config.token_expires ? new Date(config.token_expires) : null;

    if (tokenExpires && tokenExpires.getTime() > now.getTime() + 300000) {
      return config.access_token;
    }

    const refreshResponse = await fetch("https://bankaccountdata.gocardless.com/api/v2/token/refresh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: config.refresh_token })
    });

    if (!refreshResponse.ok) {
      const newTokenResponse = await fetch("https://bankaccountdata.gocardless.com/api/v2/token/new/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret_id: config.secret_id, secret_key: config.secret_key })
      });

      if (!newTokenResponse.ok) return null;

      const newTokenData: NordigenTokenResponse = await newTokenResponse.json();
      await totalumSdk.crud.editRecordById("nordigen_config", config._id, {
        access_token: newTokenData.access,
        refresh_token: newTokenData.refresh,
        token_expires: new Date(Date.now() + (newTokenData.access_expires * 1000))
      });

      return newTokenData.access;
    }

    const refreshData: NordigenTokenResponse = await refreshResponse.json();
    await totalumSdk.crud.editRecordById("nordigen_config", config._id, {
      access_token: refreshData.access,
      token_expires: new Date(Date.now() + (refreshData.access_expires * 1000))
    });

    return refreshData.access;
  } catch (error) {
    console.error("[Nordigen] Error getting access token:", error);
    return null;
  }
}

// GET - Fetch transactions from database
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("connection_id");
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "0");

    console.log(`[Nordigen Transactions] Fetching transactions, connection: ${connectionId || "all"}`);

    const filter = connectionId ? [{ bank_connection: connectionId }] : [];

    const result = await totalumSdk.crud.getRecords<BankTransaction>("bank_transaction", {
      filter,
      sort: { booking_date: -1 },
      pagination: { limit, page }
    });

    if (result.errors) {
      console.error("[Nordigen Transactions] Error:", result.errors);
      return NextResponse.json({ ok: false, error: result.errors }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: result.data || [],
      metadata: result.metadata
    });
  } catch (error) {
    console.error("[Nordigen Transactions] Error:", error);
    return NextResponse.json({ ok: false, error: "Error fetching transactions" }, { status: 500 });
  }
}

// POST - Sync transactions from Nordigen
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { connection_id: string };
    const { connection_id } = body;

    console.log(`[Nordigen Transactions] Syncing transactions for connection: ${connection_id}`);

    if (!connection_id) {
      return NextResponse.json({ ok: false, error: "Connection ID is required" }, { status: 400 });
    }

    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Nordigen not configured" }, { status: 401 });
    }

    // Get the bank connection
    const connectionResult = await totalumSdk.crud.getRecordById<BankConnection>("bank_connection", connection_id);
    if (!connectionResult.data) {
      return NextResponse.json({ ok: false, error: "Connection not found" }, { status: 404 });
    }

    const connection = connectionResult.data;
    if (connection.status !== "conectado" || !connection.account_id) {
      return NextResponse.json({ ok: false, error: "Connection not active" }, { status: 400 });
    }

    // Fetch transactions from Nordigen
    console.log(`[Nordigen Transactions] Fetching from Nordigen API for account: ${connection.account_id}`);
    const transactionsResponse = await fetch(
      `https://bankaccountdata.gocardless.com/api/v2/accounts/${connection.account_id}/transactions/`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!transactionsResponse.ok) {
      const error: NordigenErrorResponse = await transactionsResponse.json();
      console.error("[Nordigen Transactions] API error:", error);

      // Check if it's an access expired error
      if (transactionsResponse.status === 401 || error.summary?.includes("expired")) {
        await totalumSdk.crud.editRecordById("bank_connection", connection_id, { status: "expirado" });
        return NextResponse.json({
          ok: false,
          error: "La conexión ha expirado. Por favor, vuelve a conectar tu banco."
        }, { status: 401 });
      }

      return NextResponse.json({ ok: false, error }, { status: transactionsResponse.status });
    }

    const transactionsData: NordigenTransactionsResponse = await transactionsResponse.json();
    console.log(`[Nordigen Transactions] Received ${transactionsData.transactions?.booked?.length || 0} booked transactions`);

    // Get existing transaction IDs to avoid duplicates
    const existingResult = await totalumSdk.crud.getRecords<BankTransaction>("bank_transaction", {
      filter: [{ bank_connection: connection_id }],
      pagination: { limit: 1000, page: 0 }
    });

    const existingIds = new Set((existingResult.data || []).map(t => t.transaction_id));

    // Process booked transactions
    const bookedTransactions: NordigenTransaction[] = transactionsData.transactions?.booked || [];
    let newCount = 0;

    // Get base currency for conversions
    const baseCurrency = await getBaseCurrency();

    for (const tx of bookedTransactions) {
      const txId = tx.transactionId || tx.internalTransactionId || `${tx.bookingDate}-${tx.transactionAmount?.amount}`;

      if (existingIds.has(txId)) {
        continue; // Skip duplicates
      }

      const originalAmount = parseFloat(tx.transactionAmount?.amount || "0");
      const originalCurrency = (tx.transactionAmount?.currency || "EUR").toUpperCase();
      const bookingDate = tx.bookingDate || new Date().toISOString().split('T')[0];

      const transactionType: "ingreso" | "gasto" | "transferencia" =
        originalAmount > 0 ? "ingreso" :
        tx.remittanceInformationUnstructured?.toLowerCase().includes("transferencia") ? "transferencia" : "gasto";

      // Multi-currency conversion
      let baseCurrencyAmount = originalAmount;
      let exchangeRate = 1;

      if (originalCurrency !== baseCurrency.currency) {
        try {
          // Convert to base currency using the transaction date's rate
          const conversion = await convertCurrency(
            Math.abs(originalAmount), // Convert absolute value
            originalCurrency,
            baseCurrency.currency,
            bookingDate
          );
          // Preserve the sign (negative for expenses)
          baseCurrencyAmount = originalAmount < 0 ? -conversion.convertedAmount : conversion.convertedAmount;
          exchangeRate = conversion.rate;

          console.log(`[Nordigen] Converted ${originalAmount} ${originalCurrency} -> ${baseCurrencyAmount} ${baseCurrency.currency} (rate: ${exchangeRate})`);
        } catch (error) {
          console.error(`[Nordigen] Currency conversion failed for ${originalCurrency}:`, error);
          // Fall back to original amount if conversion fails
          baseCurrencyAmount = originalAmount;
        }
      }

      await totalumSdk.crud.createRecord("bank_transaction", {
        transaction_id: txId,
        description: tx.remittanceInformationUnstructured || tx.additionalInformation || "Sin descripción",
        amount: baseCurrencyAmount, // Store converted amount as main amount
        currency: baseCurrency.currency, // Use base currency
        booking_date: tx.bookingDate ? new Date(tx.bookingDate) : new Date(),
        value_date: tx.valueDate ? new Date(tx.valueDate) : new Date(),
        merchant_name: tx.creditorName || tx.debtorName || "",
        transaction_type: transactionType,
        is_processed: "no",
        bank_connection: connection_id,
        // Multi-currency fields
        original_currency: originalCurrency,
        original_amount: originalAmount,
        exchange_rate: exchangeRate,
        base_currency_amount: baseCurrencyAmount
      });

      newCount++;
    }

    // Update last sync time
    await totalumSdk.crud.editRecordById("bank_connection", connection_id, {
      last_sync: new Date()
    });

    console.log(`[Nordigen Transactions] Synced ${newCount} new transactions`);

    return NextResponse.json({
      ok: true,
      data: {
        total_fetched: bookedTransactions.length,
        new_imported: newCount,
        skipped_duplicates: bookedTransactions.length - newCount
      }
    });
  } catch (error) {
    console.error("[Nordigen Transactions] Error:", error);
    return NextResponse.json({ ok: false, error: "Error syncing transactions" }, { status: 500 });
  }
}
