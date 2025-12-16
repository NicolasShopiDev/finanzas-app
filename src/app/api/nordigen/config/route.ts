// API route for Nordigen configuration management
import { NextRequest, NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import { NordigenConfig, NordigenTokenResponse } from "@/types/database";

// GET - Check if Nordigen is configured
export async function GET() {
  try {
    console.log("[Nordigen Config] Checking configuration status...");

    const result = await totalumSdk.crud.getRecords<NordigenConfig>("nordigen_config", {
      pagination: { limit: 1, page: 0 }
    });

    if (result.errors) {
      console.error("[Nordigen Config] Error fetching config:", result.errors);
      return NextResponse.json({ ok: false, error: result.errors }, { status: 500 });
    }

    const configs = result.data || [];
    const isConfigured = configs.length > 0 && configs[0].is_configured === "si";

    console.log("[Nordigen Config] Configuration status:", isConfigured ? "Configured" : "Not configured");

    return NextResponse.json({
      ok: true,
      data: {
        isConfigured,
        hasCredentials: configs.length > 0,
        configId: configs.length > 0 ? configs[0]._id : null
      }
    });
  } catch (error) {
    console.error("[Nordigen Config] Unexpected error:", error);
    return NextResponse.json({ ok: false, error: "Error checking configuration" }, { status: 500 });
  }
}

// POST - Save Nordigen credentials
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { secret_id: string; secret_key: string };
    const { secret_id, secret_key } = body;

    console.log("[Nordigen Config] Saving new credentials...");

    if (!secret_id || !secret_key) {
      return NextResponse.json({ ok: false, error: "Secret ID and Secret Key are required" }, { status: 400 });
    }

    // Check if config already exists
    const existingResult = await totalumSdk.crud.getRecords<NordigenConfig>("nordigen_config", {
      pagination: { limit: 1, page: 0 }
    });

    // Validate credentials by trying to get a token
    console.log("[Nordigen Config] Validating credentials with Nordigen API...");
    const tokenResponse = await fetch("https://bankaccountdata.gocardless.com/api/v2/token/new/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret_id, secret_key })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("[Nordigen Config] Invalid credentials:", errorData);
      return NextResponse.json({
        ok: false,
        error: "Credenciales inválidas. Verifica tu Secret ID y Secret Key."
      }, { status: 400 });
    }

    const tokenData: NordigenTokenResponse = await tokenResponse.json();
    console.log("[Nordigen Config] Credentials validated successfully!");

    // Calculate token expiration (access token expires in access_expires seconds)
    const tokenExpires = new Date(Date.now() + (tokenData.access_expires * 1000));

    const configData = {
      secret_id,
      secret_key,
      access_token: tokenData.access,
      refresh_token: tokenData.refresh,
      token_expires: tokenExpires,
      is_configured: "si"
    };

    if (existingResult.data && existingResult.data.length > 0) {
      // Update existing config
      await totalumSdk.crud.editRecordById("nordigen_config", existingResult.data[0]._id, configData);
      console.log("[Nordigen Config] Configuration updated successfully");
    } else {
      // Create new config
      await totalumSdk.crud.createRecord("nordigen_config", configData);
      console.log("[Nordigen Config] Configuration created successfully");
    }

    return NextResponse.json({ ok: true, data: { configured: true } });
  } catch (error) {
    console.error("[Nordigen Config] Error saving credentials:", error);
    return NextResponse.json({ ok: false, error: "Error saving credentials" }, { status: 500 });
  }
}

// DELETE - Remove Nordigen credentials
export async function DELETE() {
  try {
    console.log("[Nordigen Config] Removing configuration...");

    const existingResult = await totalumSdk.crud.getRecords<NordigenConfig>("nordigen_config", {
      pagination: { limit: 1, page: 0 }
    });

    if (existingResult.data && existingResult.data.length > 0) {
      await totalumSdk.crud.deleteRecordById("nordigen_config", existingResult.data[0]._id);
      console.log("[Nordigen Config] Configuration removed successfully");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Nordigen Config] Error removing config:", error);
    return NextResponse.json({ ok: false, error: "Error removing configuration" }, { status: 500 });
  }
}
