"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface MonthlyData {
  month: number;
  monthName: string;
  budget: number;
  spent: number;
  savings: number;
}

interface CategoryBreakdown {
  id: string;
  name: string;
  icon: string;
  type: "fija" | "variable";
  totalSpent: number;
  expenseCount: number;
}

interface Statistics {
  year: number;
  monthlyData: MonthlyData[];
  categoryBreakdown: CategoryBreakdown[];
  totals: {
    totalBudget: number;
    totalSpent: number;
    totalSavings: number;
    avgMonthlySpent: number;
    totalExpenses: number;
  };
  spendingByType: {
    fixed: number;
    variable: number;
  };
}

export default function EstadisticasPage() {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const fetchStatistics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/statistics?year=${selectedYear}`);
      const data = (await res.json()) as { ok: boolean; data?: Statistics };
      console.log("[Estadisticas] Fetched statistics:", data);
      if (data.ok && data.data) {
        setStatistics(data.data);
      }
    } catch (error) {
      console.error("[Estadisticas] Error fetching statistics:", error);
    }
    setLoading(false);
  }, [selectedYear]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="card-surface border-2 border-dashed border-border rounded-2xl p-16 text-center">
            <div className="text-6xl mb-6">📊</div>
            <h2 className="text-2xl font-semibold mb-2 text-foreground">No hay datos estadísticos</h2>
            <p className="text-muted-foreground mb-6">
              Empieza a registrar tus gastos para ver estadísticas
            </p>
            <Link
              href="/"
              className="btn-primary inline-flex items-center gap-2"
            >
              Ir al Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { monthlyData, categoryBreakdown, totals, spendingByType } = statistics;

  // Find max spent for bar chart scaling
  const maxSpent = Math.max(...monthlyData.map(m => Math.max(m.spent, m.budget)), 1);
  const maxCategorySpent = Math.max(...categoryBreakdown.map(c => c.totalSpent), 1);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-display font-bold tracking-tight gradient-curva-text">
              Estadísticas
            </h1>
            <p className="text-muted-foreground text-sm sm:text-lg mt-1 sm:mt-2">
              Análisis completo de tus finanzas
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 sm:px-4 py-2 rounded-xl bg-card border border-border text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm sm:text-base"
            >
              {[2024, 2025, 2026].map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <Link
              href="/"
              className="btn-secondary text-sm sm:text-base"
            >
              ← Volver
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="card-surface p-4 sm:p-6 rounded-2xl">
            <p className="text-[10px] sm:text-caption text-muted-foreground mb-1">PRESUPUESTO</p>
            <p className="text-lg sm:text-2xl font-bold text-primary text-glow-primary truncate">
              €{totals.totalBudget.toLocaleString()}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">Acumulado anual</p>
          </div>

          <div className="card-surface p-4 sm:p-6 rounded-2xl">
            <p className="text-[10px] sm:text-caption text-muted-foreground mb-1">GASTADO</p>
            <p className="text-lg sm:text-2xl font-bold text-destructive truncate">
              €{totals.totalSpent.toLocaleString()}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{totals.totalExpenses} <span className="hidden sm:inline">transacciones</span><span className="sm:hidden">gastos</span></p>
          </div>

          <div className="card-surface p-4 sm:p-6 rounded-2xl">
            <p className="text-[10px] sm:text-caption text-muted-foreground mb-1">AHORRO</p>
            <p className={`text-lg sm:text-2xl font-bold truncate ${totals.totalSavings >= 0 ? 'text-primary text-glow-primary' : 'text-destructive'}`}>
              €{totals.totalSavings.toLocaleString()}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
              {totals.totalBudget > 0 ? ((totals.totalSavings / totals.totalBudget) * 100).toFixed(1) : 0}%
            </p>
          </div>

          <div className="card-surface p-4 sm:p-6 rounded-2xl">
            <p className="text-[10px] sm:text-caption text-muted-foreground mb-1">PROMEDIO</p>
            <p className="text-lg sm:text-2xl font-bold text-ai text-glow-ai truncate">
              €{totals.avgMonthlySpent.toFixed(0)}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Por mes</p>
          </div>
        </div>

        {/* Monthly Chart */}
        <div className="card-surface p-4 sm:p-6 rounded-2xl mb-6 sm:mb-8">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-h2 font-semibold flex items-center gap-2 text-foreground">
              <span className="text-xl sm:text-2xl">📈</span>
              Evolución Mensual
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Presupuesto vs gastos por mes</p>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {monthlyData.map((month) => (
              <div key={month.month} className="space-y-1 sm:space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-medium capitalize w-8 sm:w-12 text-foreground truncate">{month.monthName.substring(0, 3)}</span>
                  <div className="flex gap-2 sm:gap-4 text-[10px] sm:text-xs">
                    <span className="text-muted-foreground hidden sm:inline">
                      Presup: €{month.budget.toLocaleString()}
                    </span>
                    <span className={month.spent > month.budget ? "text-destructive font-medium" : "text-foreground"}>
                      €{month.spent.toLocaleString()}
                    </span>
                    <span className={month.savings >= 0 ? "text-primary" : "text-destructive"}>
                      {month.savings >= 0 ? "+" : ""}€{month.savings.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 h-4 sm:h-6 relative">
                  {/* Budget bar */}
                  <div
                    className="bg-primary/20 rounded-lg h-full transition-all"
                    style={{ width: `${(month.budget / maxSpent) * 100}%` }}
                  />
                  {/* Spent bar overlay */}
                  <div
                    className={`absolute left-0 top-0 rounded-lg h-full transition-all ${month.spent > month.budget ? 'bg-destructive' : 'bg-primary'}`}
                    style={{ width: `${(month.spent / maxSpent) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 sm:gap-6 mt-4 sm:mt-6 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-primary/20"></div>
              <span className="text-muted-foreground">Presupuesto</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-primary"></div>
              <span className="text-muted-foreground">OK</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-destructive"></div>
              <span className="text-muted-foreground">Excedido</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
          {/* Spending by Type */}
          <div className="card-surface p-4 sm:p-6 rounded-2xl">
            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-h2 font-semibold flex items-center gap-2 text-foreground">
                <span className="text-xl sm:text-2xl">📊</span>
                Gastos por Tipo
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Distribución fijos vs variables</p>
            </div>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-foreground">Gastos Fijos</span>
                  <span className="text-muted-foreground">€{spendingByType.fixed.toLocaleString()}</span>
                </div>
                <div className="h-4 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${totals.totalSpent > 0 ? (spendingByType.fixed / totals.totalSpent) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totals.totalSpent > 0 ? ((spendingByType.fixed / totals.totalSpent) * 100).toFixed(1) : 0}% del total
                </p>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-foreground">Gastos Variables</span>
                  <span className="text-muted-foreground">€{spendingByType.variable.toLocaleString()}</span>
                </div>
                <div className="h-4 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ai rounded-full transition-all"
                    style={{ width: `${totals.totalSpent > 0 ? (spendingByType.variable / totals.totalSpent) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totals.totalSpent > 0 ? ((spendingByType.variable / totals.totalSpent) * 100).toFixed(1) : 0}% del total
                </p>
              </div>

              {/* Pie chart visualization */}
              <div className="flex items-center justify-center pt-4">
                <div className="relative w-40 h-40">
                  <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                    {/* Fixed slice */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#00D68F"
                      strokeWidth="20"
                      strokeDasharray={`${totals.totalSpent > 0 ? (spendingByType.fixed / totals.totalSpent) * 251.2 : 0} 251.2`}
                    />
                    {/* Variable slice */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#00C2FF"
                      strokeWidth="20"
                      strokeDasharray={`${totals.totalSpent > 0 ? (spendingByType.variable / totals.totalSpent) * 251.2 : 0} 251.2`}
                      strokeDashoffset={`-${totals.totalSpent > 0 ? (spendingByType.fixed / totals.totalSpent) * 251.2 : 0}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">€{totals.totalSpent.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="card-surface p-6 rounded-2xl">
            <div className="mb-6">
              <h2 className="text-h2 font-semibold flex items-center gap-2 text-foreground">
                <span className="text-2xl">🏷️</span>
                Gastos por Categoría
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Ranking de categorías por gasto total</p>
            </div>
            {categoryBreakdown.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No hay categorías aún</p>
            ) : (
              <div className="space-y-4">
                {categoryBreakdown.slice(0, 8).map((category, index) => (
                  <div key={category.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{category.icon}</span>
                        <span className="font-medium text-foreground">{category.name}</span>
                        <span className={`badge ${category.type === "fija" ? "badge-primary" : "badge-ai"}`}>
                          {category.type}
                        </span>
                      </div>
                      <span className="font-semibold text-foreground">€{category.totalSpent.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-border rounded-full h-2">
                        <div
                          className={`h-full rounded-full transition-all ${index === 0 ? 'bg-destructive' : index < 3 ? 'bg-warning' : 'bg-primary'}`}
                          style={{ width: `${(category.totalSpent / maxCategorySpent) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-20 text-right">
                        {category.expenseCount} gastos
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Monthly Details Table */}
        <div className="card-surface p-6 rounded-2xl">
          <div className="mb-6">
            <h2 className="text-h2 font-semibold flex items-center gap-2 text-foreground">
              <span className="text-2xl">📅</span>
              Detalle Mensual
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Resumen completo por cada mes</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-caption">MES</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption">PRESUPUESTO</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption">GASTADO</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption">DIFERENCIA</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-caption">% USADO</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((month) => {
                  const percentage = month.budget > 0 ? (month.spent / month.budget) * 100 : 0;
                  return (
                    <tr key={month.month} className="border-b border-border/50 hover:bg-card-elevated transition-colors">
                      <td className="py-3 px-4 capitalize font-medium text-foreground">{month.monthName}</td>
                      <td className="py-3 px-4 text-right text-foreground">€{month.budget.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-foreground">€{month.spent.toLocaleString()}</td>
                      <td className={`py-3 px-4 text-right font-medium ${month.savings >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {month.savings >= 0 ? '+' : ''}€{month.savings.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`badge ${percentage > 100 ? "badge-danger" : percentage > 80 ? "badge-warning" : "badge-primary"}`}>
                          {percentage.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-card-elevated font-semibold">
                  <td className="py-3 px-4 text-foreground">Total Anual</td>
                  <td className="py-3 px-4 text-right text-foreground">€{totals.totalBudget.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-foreground">€{totals.totalSpent.toLocaleString()}</td>
                  <td className={`py-3 px-4 text-right ${totals.totalSavings >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {totals.totalSavings >= 0 ? '+' : ''}€{totals.totalSavings.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`badge ${totals.totalBudget > 0 && (totals.totalSpent / totals.totalBudget) * 100 > 100 ? "badge-danger" : "badge-primary"}`}>
                      {totals.totalBudget > 0 ? ((totals.totalSpent / totals.totalBudget) * 100).toFixed(0) : 0}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
