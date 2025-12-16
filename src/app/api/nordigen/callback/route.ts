// API route for handling the callback after bank authorization
import { NextRequest, NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import { NordigenConfig, BankConnection, NordigenTokenResponse, NordigenRequisitionResponse, NordigenAccountDetails } from "@/types/database";

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

// POST - Process callback after bank authorization
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { requisition_id: string };
    const { requisition_id } = body;

    console.log(`[Nordigen Callback] Processing requisition: ${requisition_id}`);

    if (!requisition_id) {
      return NextResponse.json({ ok: false, error: "Requisition ID is required" }, { status: 400 });
    }

    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Nordigen not configured" }, { status: 401 });
    }

    // Get requisition details from Nordigen
    const requisitionResponse = await fetch(
      `https://bankaccountdata.gocardless.com/api/v2/requisitions/${requisition_id}/`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!requisitionResponse.ok) {
      const error = await requisitionResponse.json();
      console.error("[Nordigen Callback] Error fetching requisition:", error);
      return NextResponse.json({ ok: false, error }, { status: requisitionResponse.status });
    }

    const requisitionData: NordigenRequisitionResponse = await requisitionResponse.json();
    console.log("[Nordigen Callback] Requisition data:", requisitionData);

    // Find the pending bank connection
    const connectionResult = await totalumSdk.crud.getRecords<BankConnection>("bank_connection", {
      filter: [{ requisition_id }],
      pagination: { limit: 1, page: 0 }
    });

    if (!connectionResult.data || connectionResult.data.length === 0) {
      console.error("[Nordigen Callback] Connection not found for requisition:", requisition_id);
      return NextResponse.json({ ok: false, error: "Connection not found" }, { status: 404 });
    }

    const connection = connectionResult.data[0];

    // Check requisition status
    if (requisitionData.status !== "LN") {
      // LN = Linked (successful)
      console.log("[Nordigen Callback] Requisition not linked, status:", requisitionData.status);

      let status: "pendiente" | "error" | "expirado" = "pendiente";
      if (requisitionData.status === "EX") status = "expirado";
      else if (requisitionData.status === "RJ" || requisitionData.status === "UA") status = "error";

      await totalumSdk.crud.editRecordById("bank_connection", connection._id, { status });

      return NextResponse.json({
        ok: false,
        error: `Bank authorization status: ${requisitionData.status}`,
        status: requisitionData.status
      });
    }

    // Get accounts from the requisition
    const accounts = requisitionData.accounts || [];
    if (accounts.length === 0) {
      console.error("[Nordigen Callback] No accounts found");
      await totalumSdk.crud.editRecordById("bank_connection", connection._id, { status: "error" });
      return NextResponse.json({ ok: false, error: "No accounts found" }, { status: 400 });
    }

    // Get account details for the first account
    const accountId = accounts[0];
    console.log(`[Nordigen Callback] Fetching account details for: ${accountId}`);

    const accountResponse = await fetch(
      `https://bankaccountdata.gocardless.com/api/v2/accounts/${accountId}/details/`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    let iban = "";
    let accountName = "";

    if (accountResponse.ok) {
      const accountData: NordigenAccountDetails = await accountResponse.json();
      console.log("[Nordigen Callback] Account details:", accountData);

      iban = accountData.account?.iban || "";
      accountName = accountData.account?.ownerName || accountData.account?.name || "";

      // Mask IBAN for security (show only first 4 and last 4 characters)
      if (iban.length > 8) {
        iban = iban.substring(0, 4) + "****" + iban.substring(iban.length - 4);
      }
    }

    // Update the bank connection
    await totalumSdk.crud.editRecordById("bank_connection", connection._id, {
      account_id: accountId,
      status: "conectado",
      iban,
      account_name: accountName,
      last_sync: new Date()
    });

    console.log("[Nordigen Callback] Bank connection updated successfully");

    return NextResponse.json({
      ok: true,
      data: {
        connection_id: connection._id,
        account_id: accountId,
        iban,
        account_name: accountName,
        status: "conectado"
      }
    });
  } catch (error) {
    console.error("[Nordigen Callback] Error:", error);
    return NextResponse.json({ ok: false, error: "Error processing callback" }, { status: 500 });
  }
}
