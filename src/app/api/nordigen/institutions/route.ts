// API route for fetching available banks/institutions from Nordigen
import { NextRequest, NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import { NordigenConfig, NordigenInstitution, NordigenTokenResponse } from "@/types/database";

// Helper to get valid access token
async function getValidAccessToken(): Promise<string | null> {
  try {
    const result = await totalumSdk.crud.getRecords<NordigenConfig>("nordigen_config", {
      pagination: { limit: 1, page: 0 }
    });

    if (!result.data || result.data.length === 0) {
      console.error("[Nordigen] No configuration found");
      return null;
    }

    const config = result.data[0];
    const now = new Date();
    const tokenExpires = config.token_expires ? new Date(config.token_expires) : null;

    // Check if token is still valid (with 5 minute buffer)
    if (tokenExpires && tokenExpires.getTime() > now.getTime() + 300000) {
      return config.access_token;
    }

    // Token expired, refresh it
    console.log("[Nordigen] Token expired, refreshing...");
    const refreshResponse = await fetch("https://bankaccountdata.gocardless.com/api/v2/token/refresh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: config.refresh_token })
    });

    if (!refreshResponse.ok) {
      // Refresh token also expired, need to re-authenticate
      console.log("[Nordigen] Refresh token expired, re-authenticating...");
      const newTokenResponse = await fetch("https://bankaccountdata.gocardless.com/api/v2/token/new/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret_id: config.secret_id,
          secret_key: config.secret_key
        })
      });

      if (!newTokenResponse.ok) {
        console.error("[Nordigen] Failed to get new token");
        return null;
      }

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

// GET - Fetch available institutions (banks) for a country
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get("country") || "ES"; // Default to Spain

    console.log(`[Nordigen Institutions] Fetching institutions for country: ${country}`);

    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({
        ok: false,
        error: "Nordigen not configured. Please add your credentials first."
      }, { status: 401 });
    }

    const response = await fetch(
      `https://bankaccountdata.gocardless.com/api/v2/institutions/?country=${country}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[Nordigen Institutions] API error:", errorData);
      return NextResponse.json({ ok: false, error: errorData }, { status: response.status });
    }

    const institutions: NordigenInstitution[] = await response.json();
    console.log(`[Nordigen Institutions] Found ${institutions.length} institutions`);

    // Sort by name
    institutions.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ ok: true, data: institutions });
  } catch (error) {
    console.error("[Nordigen Institutions] Error:", error);
    return NextResponse.json({ ok: false, error: "Error fetching institutions" }, { status: 500 });
  }
}
