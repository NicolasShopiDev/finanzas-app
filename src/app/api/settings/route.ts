import { NextResponse } from 'next/server';
import { z } from 'zod';
import { totalumSdk } from '@/lib/totalum';
import type { UserSettings } from '@/types/database';

function serializeError(err: unknown) {
  const e = err as { message?: string; code?: string; name?: string };
  return {
    message: e?.message ?? 'Unknown error',
    code: e?.code ?? null,
    name: e?.name ?? null,
  };
}

const updateSettingsSchema = z.object({
  base_currency: z.enum(['eur', 'usd', 'gbp', 'chf', 'jpy', 'aud', 'cad', 'mxn']).optional(),
  base_currency_symbol: z.string().optional(),
  default_country: z.string().optional(),
  date_format: z.enum(['dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd']).optional(),
});

// Currency symbol mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  eur: '€',
  usd: '$',
  gbp: '£',
  chf: 'CHF',
  jpy: '¥',
  aud: 'A$',
  cad: 'C$',
  mxn: 'MX$',
};

// GET - Get user settings (returns first/default settings record)
export async function GET() {
  try {
    console.log('[API] GET /api/settings');

    const result = await totalumSdk.crud.getRecords<UserSettings>('user_settings', {
      pagination: { limit: 1, page: 0 },
    });

    if (!result.data || result.data.length === 0) {
      // Create default settings if none exist
      console.log('[API] No settings found, creating defaults');
      const defaultSettings = await totalumSdk.crud.createRecord('user_settings', {
        base_currency: 'eur',
        base_currency_symbol: '€',
        default_country: 'ES',
        date_format: 'dd/mm/yyyy',
      });

      return NextResponse.json({ ok: true, data: defaultSettings.data });
    }

    return NextResponse.json({ ok: true, data: result.data[0] });
  } catch (err) {
    console.error('[API ERROR] GET /api/settings', err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}

// PUT - Update user settings
export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    console.log('[API] PUT /api/settings - Updating settings:', parsed.data);

    // Get existing settings
    const existingResult = await totalumSdk.crud.getRecords<UserSettings>('user_settings', {
      pagination: { limit: 1, page: 0 },
    });

    const updateData = { ...parsed.data };

    // Auto-update symbol if currency changes
    if (parsed.data.base_currency && !parsed.data.base_currency_symbol) {
      updateData.base_currency_symbol = CURRENCY_SYMBOLS[parsed.data.base_currency] || parsed.data.base_currency.toUpperCase();
    }

    if (!existingResult.data || existingResult.data.length === 0) {
      // Create new settings
      const newSettings = await totalumSdk.crud.createRecord('user_settings', {
        base_currency: updateData.base_currency || 'eur',
        base_currency_symbol: updateData.base_currency_symbol || '€',
        default_country: updateData.default_country || 'ES',
        date_format: updateData.date_format || 'dd/mm/yyyy',
      });

      return NextResponse.json({ ok: true, data: newSettings.data });
    }

    // Update existing settings
    const settingsId = existingResult.data[0]._id;
    const result = await totalumSdk.crud.editRecordById('user_settings', settingsId, updateData);

    console.log('[API] PUT /api/settings - Updated settings:', result.data);
    return NextResponse.json({ ok: true, data: result.data });
  } catch (err) {
    console.error('[API ERROR] PUT /api/settings', err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}
