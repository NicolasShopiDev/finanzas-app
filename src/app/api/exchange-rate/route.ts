import { NextResponse } from 'next/server';
import {
  getExchangeRate,
  convertCurrency,
  getAllRatesForCurrency,
  SUPPORTED_CURRENCIES
} from '@/lib/exchange-rate';

function serializeError(err: unknown) {
  const e = err as { message?: string; code?: string; name?: string };
  return {
    message: e?.message ?? 'Unknown error',
    code: e?.code ?? null,
    name: e?.name ?? null,
  };
}

// GET - Get exchange rates or convert currency
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'rate';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const amount = searchParams.get('amount');
    const date = searchParams.get('date');
    const base = searchParams.get('base');

    console.log('[API] GET /api/exchange-rate - action:', action, 'from:', from, 'to:', to);

    // Get supported currencies list
    if (action === 'currencies') {
      return NextResponse.json({
        ok: true,
        data: SUPPORTED_CURRENCIES,
      });
    }

    // Get all rates for a base currency
    if (action === 'all-rates') {
      if (!base) {
        return NextResponse.json({ ok: false, error: 'Base currency required' }, { status: 400 });
      }

      const rates = await getAllRatesForCurrency(base);
      return NextResponse.json({
        ok: true,
        data: {
          base: base.toUpperCase(),
          rates,
        },
      });
    }

    // Convert specific amount
    if (action === 'convert') {
      if (!from || !to || !amount) {
        return NextResponse.json(
          { ok: false, error: 'from, to, and amount parameters required' },
          { status: 400 }
        );
      }

      const result = await convertCurrency(
        parseFloat(amount),
        from,
        to,
        date || undefined
      );

      return NextResponse.json({
        ok: true,
        data: {
          from: from.toUpperCase(),
          to: to.toUpperCase(),
          originalAmount: parseFloat(amount),
          convertedAmount: result.convertedAmount,
          rate: result.rate,
          date: date || new Date().toISOString().split('T')[0],
        },
      });
    }

    // Default: get single exchange rate
    if (!from || !to) {
      return NextResponse.json(
        { ok: false, error: 'from and to parameters required' },
        { status: 400 }
      );
    }

    const rate = await getExchangeRate(from, to, date || undefined);

    return NextResponse.json({
      ok: true,
      data: {
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate,
        date: date || new Date().toISOString().split('T')[0],
      },
    });
  } catch (err) {
    console.error('[API ERROR] GET /api/exchange-rate', err);
    return NextResponse.json({ ok: false, error: serializeError(err) }, { status: 500 });
  }
}
