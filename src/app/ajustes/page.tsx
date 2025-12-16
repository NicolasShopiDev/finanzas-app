"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserSettings, CurrencyInfo } from "@/types/database";

// Base currencies supported for account settings
const BASE_CURRENCIES: CurrencyInfo[] = [
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', flag: '🇲🇽' },
];

const DATE_FORMATS = [
  { value: 'dd/mm/yyyy', label: 'DD/MM/YYYY (31/12/2024)' },
  { value: 'mm/dd/yyyy', label: 'MM/DD/YYYY (12/31/2024)' },
  { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD (2024-12-31)' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [baseCurrency, setBaseCurrency] = useState('eur');
  const [dateFormat, setDateFormat] = useState<'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd'>('dd/mm/yyyy');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = (await res.json()) as { ok: boolean; data?: UserSettings };
      if (data.ok && data.data) {
        setSettings(data.data);
        setBaseCurrency(data.data.base_currency);
        setDateFormat(data.data.date_format);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
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
        setSettings(data.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const selectedCurrencyInfo = BASE_CURRENCIES.find(c => c.code.toLowerCase() === baseCurrency);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Cargando ajustes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-caption text-muted-foreground mb-2">CONFIGURACION</p>
          <h1 className="text-display gradient-curva-text mb-2">Ajustes</h1>
          <p className="text-muted-foreground">
            Personaliza tu experiencia en Curva
          </p>
        </div>

        {/* Currency Settings */}
        <div className="card-surface p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-xl">💱</span>
            </div>
            <div>
              <h2 className="text-h2 text-white">Moneda Base</h2>
              <p className="text-sm text-muted-foreground">
                Tu presupuesto y todos los informes se mostrarán en esta moneda
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Moneda principal</Label>
              <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                <SelectTrigger className="mt-2 bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {BASE_CURRENCIES.map((cur) => (
                    <SelectItem key={cur.code} value={cur.code.toLowerCase()}>
                      {cur.flag} {cur.code} - {cur.name} ({cur.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCurrencyInfo && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedCurrencyInfo.flag}</span>
                  <div>
                    <p className="text-white font-medium">
                      {selectedCurrencyInfo.symbol} {selectedCurrencyInfo.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Todos los gastos en otras monedas se convertirán a {selectedCurrencyInfo.code}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Multi-currency Info */}
        <div className="card-surface p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <span className="text-xl">🌍</span>
            </div>
            <div>
              <h2 className="text-h2 text-white">Multi-Moneda para Nómadas Digitales</h2>
              <p className="text-sm text-muted-foreground">
                Registra gastos en la moneda local y Curva los convertirá automáticamente
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-start gap-3">
                <span className="text-2xl">✈️</span>
                <div>
                  <p className="text-white font-medium mb-1">Ejemplo: Viaje a Tailandia</p>
                  <p className="text-sm text-muted-foreground">
                    Registras 500 THB por una cena. Curva lo convierte automáticamente a tu moneda base
                    ({selectedCurrencyInfo?.symbol || '€'}) usando el tipo de cambio del día.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🏦</span>
                <div>
                  <p className="text-white font-medium mb-1">Importación desde Banco</p>
                  <p className="text-sm text-muted-foreground">
                    Las transacciones importadas desde tu banco mantienen la moneda original
                    y se convierten para tus informes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Date Format Settings */}
        <div className="card-surface p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-xl">📅</span>
            </div>
            <div>
              <h2 className="text-h2 text-white">Formato de Fecha</h2>
              <p className="text-sm text-muted-foreground">
                Cómo se mostrarán las fechas en la aplicación
              </p>
            </div>
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">Formato</Label>
            <Select value={dateFormat} onValueChange={(v) => setDateFormat(v as typeof dateFormat)}>
              <SelectTrigger className="mt-2 bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {DATE_FORMATS.map((fmt) => (
                  <SelectItem key={fmt.value} value={fmt.value}>
                    {fmt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between">
          <div>
            {saved && (
              <p className="text-sm text-primary flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Cambios guardados
              </p>
            )}
          </div>
          <Button
            onClick={handleSave}
            className="btn-primary"
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
}
