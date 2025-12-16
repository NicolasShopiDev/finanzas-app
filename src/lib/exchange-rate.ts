import 'server-only';
import { totalumSdk } from './totalum';
import type { ExchangeRateCache, CurrencyInfo } from '@/types/database';

// Frankfurter API response type
interface FrankfurterApiResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

// Supported currencies with metadata
export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', flag: '🇲🇽' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', flag: '🇵🇭' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', flag: '🇵🇱' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', flag: '🇨🇿' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', flag: '🇭🇺' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', flag: '🇷🇴' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', flag: '🇩🇰' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', flag: '🇭🇰' },
  { code: 'ISK', name: 'Icelandic Krona', symbol: 'kr', flag: '🇮🇸' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', flag: '🇧🇬' },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪', flag: '🇮🇱' },
];

// Frankfurter API - Free, no API key required (https://www.frankfurter.app/)
const FRANKFURTER_API_URL = 'https://api.frankfurter.app';

/**
 * Get currency info by code
 */
export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return SUPPORTED_CURRENCIES.find(c => c.code.toUpperCase() === code.toUpperCase());
}

/**
 * Get currency symbol by code
 */
export function getCurrencySymbol(code: string): string {
  return getCurrencyInfo(code)?.symbol || code;
}

/**
 * Format amount with currency symbol
 */
export function formatCurrency(amount: number, currencyCode: string): string {
  const info = getCurrencyInfo(currencyCode);
  const symbol = info?.symbol || currencyCode;

  // For currencies without decimal places (JPY, KRW, VND, etc.)
  const noDecimalCurrencies = ['JPY', 'KRW', 'VND', 'IDR', 'HUF', 'CLP'];
  const decimals = noDecimalCurrencies.includes(currencyCode.toUpperCase()) ? 0 : 2;

  return `${symbol}${amount.toFixed(decimals)}`;
}

/**
 * Check if we have a cached exchange rate that's still valid (same day)
 */
async function getCachedRate(fromCurrency: string, toCurrency: string, date: string): Promise<number | null> {
  try {
    const result = await totalumSdk.crud.getRecords<ExchangeRateCache>('exchange_rate_cache', {
      filter: [
        { from_currency: fromCurrency.toUpperCase() },
        { to_currency: toCurrency.toUpperCase() },
        { rate_date: date },
      ],
      pagination: { limit: 1, page: 0 },
    });

    if (result.data && result.data.length > 0) {
      console.log(`[ExchangeRate] Cache hit for ${fromCurrency}->${toCurrency} on ${date}`);
      return result.data[0].rate;
    }

    return null;
  } catch (error) {
    console.error('[ExchangeRate] Error checking cache:', error);
    return null;
  }
}

/**
 * Save exchange rate to cache
 */
async function cacheRate(fromCurrency: string, toCurrency: string, rate: number, date: string): Promise<void> {
  try {
    await totalumSdk.crud.createRecord('exchange_rate_cache', {
      from_currency: fromCurrency.toUpperCase(),
      to_currency: toCurrency.toUpperCase(),
      rate,
      rate_date: date,
      fetched_at: new Date().toISOString(),
    });
    console.log(`[ExchangeRate] Cached rate ${fromCurrency}->${toCurrency}: ${rate} for ${date}`);
  } catch (error) {
    console.error('[ExchangeRate] Error caching rate:', error);
  }
}

/**
 * Fetch exchange rate from Frankfurter API (free, no API key required)
 * Supports historical rates by passing a date
 */
async function fetchExchangeRateFromApi(
  fromCurrency: string,
  toCurrency: string,
  date?: string
): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  // Use historical endpoint if date is provided, otherwise use latest
  const dateEndpoint = date ? date.split('T')[0] : 'latest';
  const url = `${FRANKFURTER_API_URL}/${dateEndpoint}?from=${from}&to=${to}`;

  console.log(`[ExchangeRate] Fetching rate from Frankfurter API: ${from}->${to} (${dateEndpoint})`);

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!response.ok) {
    console.error(`[ExchangeRate] Frankfurter API returned ${response.status}`);
    throw new Error(`Exchange rate API returned ${response.status}`);
  }

  const data: FrankfurterApiResponse = await response.json();

  const rate = data.rates[to];

  if (!rate) {
    console.error(`[ExchangeRate] Rate not found for ${to} in response:`, data);
    throw new Error(`Exchange rate not found for ${toCurrency}`);
  }

  console.log(`[ExchangeRate] Got rate: 1 ${from} = ${rate} ${to}`);
  return rate;
}

/**
 * Get exchange rate for a specific date
 * Uses cache first, then fetches from API if needed
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date?: string
): Promise<number> {
  // Same currency - no conversion needed
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return 1;
  }

  // Use today's date if not specified
  const rateDate = date ? date.split('T')[0] : new Date().toISOString().split('T')[0];

  // Check cache first
  const cachedRate = await getCachedRate(fromCurrency, toCurrency, rateDate);
  if (cachedRate !== null) {
    return cachedRate;
  }

  // Fetch from Frankfurter API (supports historical dates)
  const rate = await fetchExchangeRateFromApi(fromCurrency, toCurrency, rateDate);

  // Cache the rate
  await cacheRate(fromCurrency, toCurrency, rate, rateDate);

  return rate;
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  date?: string
): Promise<{ convertedAmount: number; rate: number }> {
  const rate = await getExchangeRate(fromCurrency, toCurrency, date);
  const convertedAmount = amount * rate;

  return {
    convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimal places
    rate,
  };
}

/**
 * Get all exchange rates for a base currency
 * Useful for displaying currency selector with current rates
 */
export async function getAllRatesForCurrency(baseCurrency: string): Promise<Record<string, number>> {
  const base = baseCurrency.toUpperCase();
  const url = `${FRANKFURTER_API_URL}/latest?from=${base}`;

  console.log(`[ExchangeRate] Fetching all rates for ${base} from Frankfurter API`);

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    console.error(`[ExchangeRate] Frankfurter API returned ${response.status}`);
    throw new Error(`Exchange rate API returned ${response.status}`);
  }

  const data: FrankfurterApiResponse = await response.json();

  // Add the base currency with rate 1
  const rates = { ...data.rates, [base]: 1 };

  console.log(`[ExchangeRate] Got ${Object.keys(rates).length} rates for ${base}`);
  return rates;
}

/**
 * Clean up old cached rates (keep only last 30 days)
 */
export async function cleanupOldCachedRates(): Promise<void> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await totalumSdk.crud.getRecords<ExchangeRateCache>('exchange_rate_cache', {
      filter: [{ rate_date: { lte: thirtyDaysAgo } }],
      pagination: { limit: 100, page: 0 },
    });

    if (result.data) {
      for (const record of result.data) {
        await totalumSdk.crud.deleteRecordById('exchange_rate_cache', record._id);
      }
      console.log(`[ExchangeRate] Cleaned up ${result.data.length} old cached rates`);
    }
  } catch (error) {
    console.error('[ExchangeRate] Error cleaning up old rates:', error);
  }
}
