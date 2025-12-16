"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import type { Income, DistributionRule, UserSettings } from "@/types/database";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const INCOME_TYPES = [
  { value: "recurrente", label: "Recurrente", description: "Salario, alquileres, etc." },
  { value: "puntual", label: "Puntual", description: "Bonos, ventas, regalos" },
  { value: "transferencia_interna", label: "Transferencia interna", description: "Entre tus propias cuentas" },
];

export default function IngresosPage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [distributionRule, setDistributionRule] = useState<DistributionRule | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Dialog states
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);

  // Form states
  const [newIncome, setNewIncome] = useState({
    description: "",
    amount: 0,
    currency: "EUR",
    date: new Date().toISOString().split("T")[0],
    income_type: "puntual" as "recurrente" | "puntual" | "transferencia_interna",
    source_name: "",
  });

  const [newRule, setNewRule] = useState({
    budget_percentage: 80,
    savings_percentage: 20,
    free_percentage: 0,
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch user settings
      const settingsRes = await fetch('/api/settings');
      const settingsData = (await settingsRes.json()) as { ok: boolean; data?: UserSettings };
      if (settingsData.ok && settingsData.data) {
        setUserSettings(settingsData.data);
        setNewIncome(prev => ({ ...prev, currency: settingsData.data!.base_currency.toUpperCase() }));
      }

      // Fetch incomes for selected month/year
      const incomeRes = await fetch(`/api/income?month=${selectedMonth}&year=${selectedYear}`);
      const incomeData = (await incomeRes.json()) as { ok: boolean; data?: Income[] };
      console.log("[Ingresos] Fetched incomes:", incomeData);
      if (incomeData.ok && incomeData.data) {
        setIncomes(incomeData.data);
      }

      // Fetch distribution rule
      const ruleRes = await fetch('/api/distribution-rule');
      const ruleData = (await ruleRes.json()) as { ok: boolean; data?: DistributionRule };
      console.log("[Ingresos] Fetched distribution rule:", ruleData);
      if (ruleData.ok && ruleData.data) {
        setDistributionRule(ruleData.data);
        setNewRule({
          budget_percentage: ruleData.data.budget_percentage,
          savings_percentage: ruleData.data.savings_percentage,
          free_percentage: ruleData.data.free_percentage,
        });
      }
    } catch (error) {
      console.error("[Ingresos] Error fetching data:", error);
    }
    setLoading(false);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate totals
  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const confirmedIncome = incomes
    .filter(i => i.status === "confirmado" && i.income_type !== "transferencia_interna")
    .reduce((sum, i) => sum + i.amount, 0);
  const pendingIncome = incomes.filter(i => i.status === "pendiente_revision");

  const distributedToBudget = incomes.reduce((sum, i) => sum + (i.distributed_to_budget || 0), 0);
  const distributedToSavings = incomes.reduce((sum, i) => sum + (i.distributed_to_savings || 0), 0);
  const distributedToFree = incomes.reduce((sum, i) => sum + (i.distributed_to_free || 0), 0);

  // Handlers
  const handleCreateIncome = async () => {
    try {
      const res = await fetch("/api/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newIncome,
          month: selectedMonth,
          year: selectedYear,
          auto_distribute: newIncome.income_type !== "transferencia_interna",
        }),
      });
      const data = (await res.json()) as { ok: boolean; data?: Income };
      console.log("[Ingresos] Created income:", data);
      if (data.ok) {
        setIncomeDialogOpen(false);
        setNewIncome({
          description: "",
          amount: 0,
          currency: userSettings?.base_currency.toUpperCase() || "EUR",
          date: new Date().toISOString().split("T")[0],
          income_type: "puntual",
          source_name: "",
        });
        fetchData();
      }
    } catch (error) {
      console.error("[Ingresos] Error creating income:", error);
    }
  };

  const handleUpdateRule = async () => {
    try {
      const res = await fetch("/api/distribution-rule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRule),
      });
      const data = (await res.json()) as { ok: boolean; data?: DistributionRule; error?: string };
      console.log("[Ingresos] Updated distribution rule:", data);
      if (data.ok) {
        setRuleDialogOpen(false);
        fetchData();
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error("[Ingresos] Error updating distribution rule:", error);
    }
  };

  const handleDeleteIncome = async (incomeId: string) => {
    if (!confirm("¿Eliminar este ingreso?")) return;
    try {
      const res = await fetch(`/api/income?id=${incomeId}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("[Ingresos] Error deleting income:", error);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const currencySymbol = userSettings?.base_currency_symbol || "€";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Cargando ingresos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass-nav sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
                <span className="text-3xl">💰</span>
                Ingresos
              </h1>
              <p className="text-sm text-muted-foreground">
                Gestiona tus fuentes de dinero
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Month Selector */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-32 bg-card border-border rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={i} value={(i + 1).toString()}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-24 bg-card border-border rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {[2024, 2025, 2026].map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Total Income Card */}
          <div className="card-elevated p-6 rounded-2xl">
            <p className="text-caption text-muted-foreground mb-1">INGRESOS TOTALES</p>
            <p className="text-3xl font-bold text-primary text-glow-primary">
              {currencySymbol}{formatCurrency(totalIncome)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {incomes.length} {incomes.length === 1 ? "entrada" : "entradas"} este mes
            </p>
          </div>

          {/* Confirmed Income Card */}
          <div className="card-surface p-6 rounded-2xl">
            <p className="text-caption text-muted-foreground mb-1">CONFIRMADOS (DISTRIBUCIÓN)</p>
            <p className="text-2xl font-bold text-foreground">
              {currencySymbol}{formatCurrency(confirmedIncome)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Excluye transferencias internas
            </p>
          </div>

          {/* Pending Review Card */}
          <div className="card-surface p-6 rounded-2xl">
            <p className="text-caption text-muted-foreground mb-1">PENDIENTES DE REVISIÓN</p>
            <p className="text-2xl font-bold text-warning">
              {pendingIncome.length}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Requieren confirmación
            </p>
          </div>
        </div>

        {/* Distribution Rule Card */}
        <div className="card-elevated p-6 rounded-2xl mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span>⚖️</span>
                Regla de Distribución
              </h2>
              <p className="text-sm text-muted-foreground">
                Cómo se distribuyen automáticamente tus ingresos
              </p>
            </div>
            <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-border">
                  Editar
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-popover border-border">
                <DialogHeader>
                  <DialogTitle className="text-white">Editar Regla de Distribución</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Define cómo se reparten automáticamente tus ingresos. Los porcentajes deben sumar 100%.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Presupuesto (%)</Label>
                    <Input
                      type="number"
                      value={newRule.budget_percentage}
                      onChange={(e) => setNewRule({ ...newRule, budget_percentage: parseFloat(e.target.value) || 0 })}
                      className="mt-2 bg-muted border-border"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Para gastos del mes</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Ahorro (%)</Label>
                    <Input
                      type="number"
                      value={newRule.savings_percentage}
                      onChange={(e) => setNewRule({ ...newRule, savings_percentage: parseFloat(e.target.value) || 0 })}
                      className="mt-2 bg-muted border-border"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Se acumula en tu hucha</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Libre (%)</Label>
                    <Input
                      type="number"
                      value={newRule.free_percentage}
                      onChange={(e) => setNewRule({ ...newRule, free_percentage: parseFloat(e.target.value) || 0 })}
                      className="mt-2 bg-muted border-border"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Dinero sin asignar</p>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    newRule.budget_percentage + newRule.savings_percentage + newRule.free_percentage === 100
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-destructive/10 border border-destructive/20"
                  }`}>
                    <p className="text-sm font-medium">
                      Total: {newRule.budget_percentage + newRule.savings_percentage + newRule.free_percentage}%
                      {newRule.budget_percentage + newRule.savings_percentage + newRule.free_percentage !== 100 && (
                        <span className="text-destructive ml-2">(debe ser 100%)</span>
                      )}
                    </p>
                  </div>
                  <Button
                    onClick={handleUpdateRule}
                    className="w-full btn-primary"
                    disabled={newRule.budget_percentage + newRule.savings_percentage + newRule.free_percentage !== 100}
                  >
                    Guardar Regla
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {distributionRule && (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-3xl font-bold text-blue-400">{distributionRule.budget_percentage}%</p>
                <p className="text-sm text-muted-foreground mt-1">Presupuesto</p>
                <p className="text-xs text-blue-400 mt-2">
                  {currencySymbol}{formatCurrency(distributedToBudget)}
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-3xl font-bold text-green-400">{distributionRule.savings_percentage}%</p>
                <p className="text-sm text-muted-foreground mt-1">Ahorro</p>
                <p className="text-xs text-green-400 mt-2">
                  {currencySymbol}{formatCurrency(distributedToSavings)}
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <p className="text-3xl font-bold text-purple-400">{distributionRule.free_percentage}%</p>
                <p className="text-sm text-muted-foreground mt-1">Libre</p>
                <p className="text-xs text-purple-400 mt-2">
                  {currencySymbol}{formatCurrency(distributedToFree)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Income List */}
        <div className="card-surface rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Lista de Ingresos</h2>
            <Dialog open={incomeDialogOpen} onOpenChange={setIncomeDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-primary">
                  <span className="mr-2">+</span> Nuevo Ingreso
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-popover border-border">
                <DialogHeader>
                  <DialogTitle className="text-white">Registrar Ingreso</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Añade un nuevo ingreso. Se distribuirá automáticamente según tu regla.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Descripción</Label>
                    <Input
                      value={newIncome.description}
                      onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
                      placeholder="Ej: Salario Enero"
                      className="mt-2 bg-muted border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Cantidad ({currencySymbol})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newIncome.amount || ""}
                      onChange={(e) => setNewIncome({ ...newIncome, amount: parseFloat(e.target.value) || 0 })}
                      placeholder="2500"
                      className="mt-2 bg-muted border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Fecha</Label>
                    <Input
                      type="date"
                      value={newIncome.date}
                      onChange={(e) => setNewIncome({ ...newIncome, date: e.target.value })}
                      className="mt-2 bg-muted border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Tipo de Ingreso</Label>
                    <Select
                      value={newIncome.income_type}
                      onValueChange={(v: "recurrente" | "puntual" | "transferencia_interna") =>
                        setNewIncome({ ...newIncome, income_type: v })
                      }
                    >
                      <SelectTrigger className="mt-2 bg-muted border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {INCOME_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <span>{type.label}</span>
                              <span className="text-xs text-muted-foreground ml-2">({type.description})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {newIncome.income_type === "transferencia_interna" && (
                      <p className="text-xs text-warning mt-2">
                        Las transferencias internas no afectan métricas ni se distribuyen
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Fuente (opcional)</Label>
                    <Input
                      value={newIncome.source_name}
                      onChange={(e) => setNewIncome({ ...newIncome, source_name: e.target.value })}
                      placeholder="Ej: Empresa ABC"
                      className="mt-2 bg-muted border-border"
                    />
                  </div>
                  <Button
                    onClick={handleCreateIncome}
                    className="w-full btn-primary"
                    disabled={!newIncome.description || !newIncome.amount}
                  >
                    Registrar Ingreso
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {incomes.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <span className="text-3xl">💸</span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Sin ingresos registrados</h3>
              <p className="text-muted-foreground mb-4">
                Registra tu primer ingreso de {MONTH_NAMES[selectedMonth - 1]}
              </p>
              <Button onClick={() => setIncomeDialogOpen(true)} className="btn-primary">
                Añadir Ingreso
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {incomes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((income) => (
                <div
                  key={income._id}
                  className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      income.income_type === "recurrente"
                        ? "bg-blue-500/10 text-blue-400"
                        : income.income_type === "transferencia_interna"
                        ? "bg-gray-500/10 text-gray-400"
                        : "bg-green-500/10 text-green-400"
                    }`}>
                      {income.income_type === "recurrente" ? "🔄" : income.income_type === "transferencia_interna" ? "↔️" : "💵"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{income.description}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{new Date(income.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
                        {income.source_name && (
                          <>
                            <span>•</span>
                            <span className="truncate">{income.source_name}</span>
                          </>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          income.status === "confirmado"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-warning/10 text-warning"
                        }`}>
                          {income.status === "confirmado" ? "Confirmado" : "Pendiente"}
                        </span>
                        {income.income_type === "transferencia_interna" && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-500/10 text-gray-400">
                            Interna
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-lg text-primary">
                        +{currencySymbol}{formatCurrency(income.amount)}
                      </p>
                      {income.is_distributed === "si" && income.income_type !== "transferencia_interna" && (
                        <p className="text-xs text-muted-foreground">
                          Distribuido
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteIncome(income._id)}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips Section */}
        <div className="mt-6 card-surface p-6 rounded-2xl">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
            <span>💡</span>
            Consejos sobre Ingresos
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-card">
              <h4 className="font-semibold mb-1 text-foreground">Distribución Automática</h4>
              <p className="text-sm text-muted-foreground">
                Cada ingreso confirmado se reparte según tu regla: presupuesto, ahorro y libre.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card">
              <h4 className="font-semibold mb-1 text-foreground">Transferencias Internas</h4>
              <p className="text-sm text-muted-foreground">
                No afectan tus métricas. Úsalas para mover dinero entre tus propias cuentas.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card">
              <h4 className="font-semibold mb-1 text-foreground">Regla Sugerida</h4>
              <p className="text-sm text-muted-foreground">
                80% presupuesto, 20% ahorro es un buen punto de partida. Ajústalo según tus objetivos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
