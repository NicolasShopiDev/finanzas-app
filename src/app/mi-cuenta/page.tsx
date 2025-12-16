"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { UserSettings, CurrencyInfo } from "@/types/database";

// Currency configurations with formatting examples
const CURRENCIES: CurrencyInfo[] = [
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'USD', name: 'Dólar estadounidense', symbol: '$', flag: '🇺🇸' },
  { code: 'GBP', name: 'Libra esterlina', symbol: '£', flag: '🇬🇧' },
  { code: 'CHF', name: 'Franco suizo', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'JPY', name: 'Yen japonés', symbol: '¥', flag: '🇯🇵' },
  { code: 'AUD', name: 'Dólar australiano', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Dólar canadiense', symbol: 'C$', flag: '🇨🇦' },
  { code: 'MXN', name: 'Peso mexicano', symbol: 'MX$', flag: '🇲🇽' },
];

const DATE_FORMATS = [
  { value: 'dd/mm/yyyy', label: 'DD/MM/YYYY', example: '31/12/2024' },
  { value: 'mm/dd/yyyy', label: 'MM/DD/YYYY', example: '12/31/2024' },
  { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD', example: '2024-12-31' },
];

// Format currency for preview
function formatCurrencyPreview(currency: CurrencyInfo): string {
  const amount = 1234.56;
  // Different formatting based on currency
  switch(currency.code) {
    case 'JPY':
      return `${currency.symbol}${Math.round(amount).toLocaleString()}`;
    case 'EUR':
      return `${amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${currency.symbol}`;
    default:
      return `${currency.symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }
}

export default function MiCuentaPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Form state
  const [baseCurrency, setBaseCurrency] = useState('eur');
  const [dateFormat, setDateFormat] = useState<'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd'>('dd/mm/yyyy');

  // Mock user profile data (in a real app, this would come from auth)
  const userProfile = {
    name: "Usuario de Curva",
    email: "usuario@curva.app",
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      console.log('[Mi Cuenta] Fetching user settings...');
      const res = await fetch('/api/settings');
      const data = (await res.json()) as { ok: boolean; data?: UserSettings };
      if (data.ok && data.data) {
        console.log('[Mi Cuenta] Settings loaded:', data.data);
        setSettings(data.data);
        setBaseCurrency(data.data.base_currency);
        setDateFormat(data.data.date_format);
      }
    } catch (error) {
      console.error('[Mi Cuenta] Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    setSaved(false);
    try {
      console.log('[Mi Cuenta] Saving preferences...');
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_currency: baseCurrency,
          date_format: dateFormat,
        }),
      });
      const data = (await res.json()) as { ok: boolean; data?: UserSettings };
      if (data.ok && data.data) {
        console.log('[Mi Cuenta] Preferences saved:', data.data);
        setSettings(data.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('[Mi Cuenta] Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      console.log('[Mi Cuenta] Logging out...');
      // Clear any local storage tokens
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth-token');
      }
      // Redirect to home/login page
      router.push('/');
    } catch (error) {
      console.error('[Mi Cuenta] Logout error:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const selectedCurrency = CURRENCIES.find(c => c.code.toLowerCase() === baseCurrency);
  const selectedDateFormat = DATE_FORMATS.find(f => f.value === dateFormat);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Cargando tu cuenta...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Page Header */}
        <div className="mb-8">
          <p className="text-caption text-muted-foreground mb-2">CONFIGURACIÓN</p>
          <h1 className="text-display gradient-curva-text mb-2">Mi cuenta</h1>
          <p className="text-muted-foreground">
            Gestiona tu perfil y preferencias
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            PROFILE SECTION
           ═══════════════════════════════════════════════════════════════════ */}
        <section className="card-surface p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-h2 text-white">Perfil</h2>
              <p className="text-sm text-muted-foreground">
                Tu información personal
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nombre</p>
                <p className="text-white font-medium">{userProfile.name}</p>
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="text-white font-medium">{userProfile.email}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            PREFERENCES SECTION
           ═══════════════════════════════════════════════════════════════════ */}
        <section className="card-surface p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00C2FF]/10 flex items-center justify-center">
              <SlidersIcon className="w-5 h-5 text-[#00C2FF]" />
            </div>
            <div>
              <h2 className="text-h2 text-white">Preferencias</h2>
              <p className="text-sm text-muted-foreground">
                Personaliza tu experiencia
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Currency Selector with Preview */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                Moneda
              </Label>
              <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code.toLowerCase()}>
                      <span className="flex items-center gap-2">
                        <span>{currency.flag}</span>
                        <span>{currency.code}</span>
                        <span className="text-muted-foreground">- {currency.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Currency Format Preview */}
              {selectedCurrency && (
                <div className="mt-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{selectedCurrency.flag}</span>
                      <div>
                        <p className="text-sm text-muted-foreground">Vista previa del formato</p>
                        <p className="text-white font-semibold text-lg tabular-nums">
                          {formatCurrencyPreview(selectedCurrency)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Símbolo</p>
                      <p className="text-primary font-bold text-xl">{selectedCurrency.symbol}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator className="bg-border/50" />

            {/* Date Format */}
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                Formato de fecha
              </Label>
              <Select value={dateFormat} onValueChange={(v) => setDateFormat(v as typeof dateFormat)}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {DATE_FORMATS.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      <span className="flex items-center gap-2">
                        <span>{format.label}</span>
                        <span className="text-muted-foreground">({format.example})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date Format Preview */}
              {selectedDateFormat && (
                <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Ejemplo: </span>
                    <span className="text-white font-medium">{selectedDateFormat.example}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Save Preferences Button */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {saved && (
                  <p className="text-sm text-primary flex items-center gap-2">
                    <CheckIcon className="w-4 h-4" />
                    Preferencias guardadas
                  </p>
                )}
              </div>
              <Button
                onClick={handleSavePreferences}
                className="btn-primary"
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar preferencias'}
              </Button>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SESSION SECTION
           ═══════════════════════════════════════════════════════════════════ */}
        <section className="card-surface p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <LogoutIcon className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-h2 text-white">Sesión</h2>
              <p className="text-sm text-muted-foreground">
                Gestiona tu sesión activa
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-white font-medium mb-1">Cerrar sesión</p>
                <p className="text-sm text-muted-foreground">
                  Salir de tu cuenta en este dispositivo
                </p>
              </div>
              <Button
                onClick={handleLogout}
                variant="destructive"
                className="px-6 py-3 rounded-full font-semibold transition-all duration-200 hover:opacity-90 hover:shadow-lg"
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Cerrando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogoutIcon className="w-4 h-4" />
                    Cerrar sesión
                  </span>
                )}
              </Button>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            LEGAL SECTION
           ═══════════════════════════════════════════════════════════════════ */}
        <section className="card-surface p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <DocumentIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-h2 text-white">Legal</h2>
              <p className="text-sm text-muted-foreground">
                Documentos y políticas
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Terms of Service */}
            <Link
              href="/terms-of-service"
              className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 hover:border-border transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <FileTextIcon className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
                <div>
                  <p className="text-white font-medium group-hover:text-primary transition-colors">
                    Términos y condiciones
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Condiciones de uso del servicio
                  </p>
                </div>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
            </Link>

            {/* Privacy Policy */}
            <Link
              href="/privacy-policy"
              className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 hover:border-border transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <ShieldIcon className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
                <div>
                  <p className="text-white font-medium group-hover:text-primary transition-colors">
                    Política de privacidad
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cómo tratamos tus datos
                  </p>
                </div>
              </div>
              <ChevronRightIcon className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
            </Link>
          </div>
        </section>

        {/* Footer spacer */}
        <div className="h-8"></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
