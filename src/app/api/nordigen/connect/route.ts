// API route for initiating bank connection via Nordigen
import { NextRequest, NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import { NordigenConfig, NordigenTokenResponse, NordigenEUAResponse, NordigenRequisitionResponse } from "@/types/database";

// Helper to get valid access token
async function getValidAccessToken(): Promise<string | null> {
  try {
    const result = await totalumSdk.crud.getRecords<NordigenConfig>("nordigen_config", {
      pagination: { limit: 1, page: 0 }
    });

    if (!result.data || result.data.length === 0) {
      return null;
    }

    const config = result.data[0];
    const now = new Date();
    const tokenExpires = config.token_expires ? new Date(config.token_expires) : null;

    if (tokenExpires && tokenExpires.getTime() > now.getTime() + 300000) {
      return config.access_token;
    }

    // Refresh token if needed
    const refreshResponse = await fetch("https://bankaccountdata.gocardless.com/api/v2/token/refresh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: config.refresh_token })
    });

    if (!refreshResponse.ok) {
      const newTokenResponse = await fetch("https://bankaccountdata.gocardless.com/api/v2/token/new/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret_id: config.secret_id,
          secret_key: config.secret_key
        })
      });

      if (!newTokenResponse.ok) return null;

      const newTokenData: NordigenTokenResponse = await newTokenResponse.json();
      const newExpires = new Date(Date.now() + (newTokenData.access_expires * 1000));

      await totalumSdk.crud.editRecordById("nordigen_config", config._id, {
        access_token: newTokenData.access,
        refresh_token: newTokenData.refresh,
        token_expires: newExpires
      });

      return newTokenData.access;
    }

    const refreshData: NordigenTokenResponse = await refreshResponse.json();
    const newExpires = new Date(Date.now() + (refreshData.access_expires * 1000));

    await totalumSdk.crud.editRecordById("nordigen_config", config._id, {
      access_token: refreshData.access,
      token_expires: newExpires
    });

    return refreshData.access;
  } catch (error) {
    console.error("[Nordigen] Error getting access token:", error);
    return null;
  }
}

// POST - Create requisition (bank authorization link)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { institution_id: string; institution_name: string; redirect_url: string };
    const { institution_id, institution_name, redirect_url } = body;

    console.log(`[Nordigen Connect] Creating requisition for institution: ${institution_id}`);

    if (!institution_id) {
      return NextResponse.json({ ok: false, error: "Institution ID is required" }, { status: 400 });
    }

    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({
        ok: false,
        error: "Nordigen not configured"
      }, { status: 401 });
    }

    // Create End User Agreement (EUA) first - valid for 90 days by default
    console.log("[Nordigen Connect] Creating End User Agreement...");
    const euaResponse = await fetch("https://bankaccountdata.gocardless.com/api/v2/agreements/enduser/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        institution_id,
        max_historical_days: 90, // Get up to 90 days of transaction history
        access_valid_for_days: 90, // Access valid for 90 days
        access_scope: ["balances", "details", "transactions"]
      })
    });

    if (!euaResponse.ok) {
      const euaError = await euaResponse.json();
      console.error("[Nordigen Connect] EUA error:", euaError);
      return NextResponse.json({ ok: false, error: euaError }, { status: euaResponse.status });
    }

    const euaData: NordigenEUAResponse = await euaResponse.json();
    console.log("[Nordigen Connect] EUA created:", euaData.id);

    // Create the requisition
    console.log("[Nordigen Connect] Creating requisition...");
    const requisitionResponse = await fetch("https://bankaccountdata.gocardless.com/api/v2/requisitions/", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        redirect: redirect_url,
        institution_id,
        agreement: euaData.id,
        user_language: "ES"
      })
    });

    if (!requisitionResponse.ok) {
      const reqError = await requisitionResponse.json();
      console.error("[Nordigen Connect] Requisition error:", reqError);
      return NextResponse.json({ ok: false, error: reqError }, { status: requisitionResponse.status });
    }

    const requisitionData: NordigenRequisitionResponse = await requisitionResponse.json();
    console.log("[Nordigen Connect] Requisition created:", requisitionData.id);

    // Save the pending bank connection
    const connectionResult = await totalumSdk.crud.createRecord("bank_connection", {
      bank_name: institution_name || institution_id,
      bank_id: institution_id,
      requisition_id: requisitionData.id,
      account_id: "",
      status: "pendiente",
      iban: "",
      account_name: ""
    });

    console.log("[Nordigen Connect] Bank connection saved:", connectionResult.data?._id);

    return NextResponse.json({
      ok: true,
      data: {
        requisition_id: requisitionData.id,
        link: requisitionData.link,
        connection_id: connectionResult.data?._id
      }
    });
  } catch (error) {
    console.error("[Nordigen Connect] Error:", error);
    return NextResponse.json({ ok: false, error: "Error creating bank connection" }, { status: 500 });
  }
}
