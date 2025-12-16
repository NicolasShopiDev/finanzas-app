"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SmartAlert, AlertAnalysis } from "@/types/database";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, ChevronsUpDown, TrendingUp, TrendingDown, Minus, BrainCircuit, ShieldAlert, Sparkles, AlertTriangle } from "lucide-react";

// Alert type display configuration with Curva colors
const alertTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  presupuesto_excedido: {
    icon: <ShieldAlert className="w-6 h-6" />,
    label: "Presupuesto Excedido",
    color: "destructive"
  },
  prevision_deficit: {
    icon: <TrendingDown className="w-6 h-6" />,
    label: "Previsión de Déficit",
    color: "warning"
  },
  patron_detectado: {
    icon: <BrainCircuit className="w-6 h-6" />,
    label: "Patrón Detectado",
    color: "ai"
  },
  colchon_peligro: {
    icon: <AlertTriangle className="w-6 h-6" />,
    label: "Colchón en Peligro",
    color: "destructive"
  },
  oportunidad_ahorro: {
    icon: <Sparkles className="w-6 h-6" />,
    label: "Oportunidad de Ahorro",
    color: "primary"
  }
};

// Risk level configuration with Curva colors
const riskConfig: Record<string, { color: string; label: string }> = {
  low: { color: "text-primary", label: "Bajo" },
  medium: { color: "text-warning", label: "Medio" },
  high: { color: "text-destructive", label: "Alto" }
};

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [analysis, setAnalysis] = useState<AlertAnalysis & { stats?: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const hasAutoAnalyzed = useRef(false);

  // API response type
  interface AlertsApiResponse {
    ok: boolean;
    data?: {
      alerts: SmartAlert[];
      summary?: {
        criticalCount: number;
        warningCount: number;
        infoCount: number;
        totalAlerts: number;
      };
      prediction?: {
        endOfMonthBalance: number;
        riskLevel: "low" | "medium" | "high";
        daysUntilDanger: number | null;
        safetyMargin: number;
      };
      stats?: {
        totalBudget: number;
        totalSpent: number;
        percentageUsed: number;
        previousMonth?: {
          totalSpent: number;
          trendMessage: string;
        }
      };
    };
    error?: string;
  }

  // Fetch existing alerts
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setLoadingStep("Cargando alertas...");
      const response = await fetch("/api/alerts");
      const result: AlertsApiResponse = await response.json();

      if (result.ok && result.data) {
        setAlerts(result.data.alerts || []);
        console.log("[Alertas] Loaded", result.data.alerts?.length || 0, "alerts");
      } else {
        setError(result.error || "Error al cargar alertas");
      }
    } catch (err) {
      console.error("[Alertas] Error:", err);
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Auto-analysis effect
  useEffect(() => {
    if (!loading && alerts.length === 0 && !generating && !hasAutoAnalyzed.current) {
      console.log("[Alertas] Auto-triggering analysis...");
      hasAutoAnalyzed.current = true;
      handleGenerateAlerts();
    }
  }, [loading, alerts]);

  // Generate new alerts with AI
  const handleGenerateAlerts = async () => {
    try {
      setGenerating(true);
      setError(null);
      setLoadingStep("Analizando gastos...");

      // Simulate steps for better UX
      setTimeout(() => setLoadingStep("Consultando historial..."), 1500);
      setTimeout(() => setLoadingStep("Detectando patrones..."), 3000);

      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" })
      });

      const result: AlertsApiResponse = await response.json();

      if (result.ok && result.data) {
        setAlerts(result.data.alerts || []);
        setAnalysis({
          alerts: result.data.alerts || [],
          summary: result.data.summary || { criticalCount: 0, warningCount: 0, infoCount: 0, totalAlerts: 0 },
          prediction: result.data.prediction || { endOfMonthBalance: 0, riskLevel: "low", daysUntilDanger: null, safetyMargin: 0 },
          stats: result.data.stats
        });
        console.log("[Alertas] Generated", result.data.alerts?.length || 0, "new alerts");
      } else {
        setError(result.error || "Error al generar alertas");
      }
    } catch (err) {
      console.error("[Alertas] Generate error:", err);
      setError("Error al generar alertas");
    } finally {
      setGenerating(false);
    }
  };

  // Dismiss an alert
  const handleDismissAlert = async (alertId: string) => {
    try {
      // Optimistic update
      setAlerts(prev => prev.filter(a => a._id !== alertId));

      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", alertId })
      });

      if (!response.ok) {
        // Revert if failed (simplified, assuming refresh on error)
        fetchAlerts();
      }
    } catch (err) {
      console.error("[Alertas] Dismiss error:", err);
    }
  };

  // Dismiss all alerts
  const handleDismissAll = async () => {
    try {
      setAlerts([]);
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss_all" })
      });
      if (!response.ok) fetchAlerts();
    } catch (err) {
      console.error("[Alertas] Dismiss all error:", err);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR"
    }).format(amount);
  };

  // Count alerts by severity
  const criticalCount = alerts.filter(a => a.severity === "critical").length;
  const warningCount = alerts.filter(a => a.severity === "warning").length;
  const infoCount = alerts.filter(a => a.severity === "info").length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-display font-bold gradient-curva-text flex items-center gap-3">
                Alertas Inteligentes
                <span className="w-2 h-2 rounded-full bg-ai ai-pulse"></span>
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                IA que analiza tus finanzas y te avisa antes de que sea tarde
              </p>
            </div>
            <div className="flex gap-3">
              {alerts.length > 0 && (
                <button
                  onClick={handleDismissAll}
                  className="btn-secondary text-sm"
                >
                  Descartar todas
                </button>
              )}
              <button
                onClick={handleGenerateAlerts}
                disabled={generating}
                className="btn-ai flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analizando...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="w-5 h-5" />
                    Analizar con IA
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {generating && (
          <div className="card-surface rounded-2xl p-12 text-center mb-8 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 mx-auto mb-6 gradient-curva rounded-full flex items-center justify-center animate-pulse">
              <BrainCircuit className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-foreground">{loadingStep}</h3>
            <p className="text-muted-foreground">La IA está procesando tus transacciones recientes...</p>
          </div>
        )}

        {/* Summary Cards */}
        {analysis && !generating && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Prediction Card */}
            <div className="card-elevated p-6 rounded-2xl col-span-1 md:col-span-2">
              <h3 className="text-h2 font-semibold mb-4 flex items-center gap-2 text-foreground">
                <TrendingUp className="w-5 h-5 text-ai" />
                Previsión de Fin de Mes
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-card rounded-xl">
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(analysis.prediction.endOfMonthBalance)}
                  </p>
                  <p className="text-caption text-muted-foreground mt-1">BALANCE PROYECTADO</p>
                </div>
                <div className="text-center p-3 bg-card rounded-xl">
                  <p className={`text-2xl font-bold ${riskConfig[analysis.prediction.riskLevel].color}`}>
                    {riskConfig[analysis.prediction.riskLevel].label}
                  </p>
                  <p className="text-caption text-muted-foreground mt-1">NIVEL DE RIESGO</p>
                </div>
                <div className="text-center p-3 bg-card rounded-xl">
                  <p className="text-2xl font-bold text-foreground">
                    {analysis.prediction.daysUntilDanger !== null ? analysis.prediction.daysUntilDanger : "∞"}
                  </p>
                  <p className="text-caption text-muted-foreground mt-1">DÍAS HASTA PELIGRO</p>
                </div>
                <div className="text-center p-3 bg-card rounded-xl">
                  {analysis.stats?.previousMonth ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="flex items-center gap-1">
                        {analysis.stats.totalSpent > analysis.stats.previousMonth.totalSpent ? (
                          <TrendingUp className="w-5 h-5 text-destructive" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-primary" />
                        )}
                        <span className={`text-xl font-bold ${analysis.stats.totalSpent > analysis.stats.previousMonth.totalSpent ? "text-destructive" : "text-primary"}`}>
                          {Math.round(((analysis.stats.totalSpent - analysis.stats.previousMonth.totalSpent) / analysis.stats.previousMonth.totalSpent) * 100)}%
                        </span>
                      </div>
                      <p className="text-caption text-muted-foreground mt-1">VS MES ANTERIOR</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className="text-xl font-bold text-muted">+0%</span>
                      <p className="text-caption text-muted-foreground mt-1">VS MES ANTERIOR</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Budget Progress */}
              {analysis.stats && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Presupuesto utilizado ({analysis.stats.percentageUsed}%)</span>
                    <span className="font-medium">{formatCurrency(analysis.stats.totalSpent)} / {formatCurrency(analysis.stats.totalBudget)}</span>
                  </div>
                  <Progress value={analysis.stats.percentageUsed} className="h-2" />
                </div>
              )}
            </div>

            {/* Alert Summary Card */}
            <div className="card-elevated p-6 rounded-2xl">
              <h3 className="text-h2 font-semibold mb-4 flex items-center gap-2 text-foreground">
                <ShieldAlert className="w-5 h-5 text-ai" />
                Resumen
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive"></div>
                    <span className="text-sm font-medium text-destructive-foreground">Críticas</span>
                  </div>
                  <span className="font-bold text-destructive text-lg">{criticalCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-warning"></div>
                    <span className="text-sm font-medium text-warning-foreground">Advertencias</span>
                  </div>
                  <span className="font-bold text-warning text-lg">{warningCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-ai/10 border border-ai/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-ai"></div>
                    <span className="text-sm font-medium text-ai-foreground">Informativas</span>
                  </div>
                  <span className="font-bold text-ai text-lg">{infoCount}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Initial State (only if not generating) */}
        {loading && !generating && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-ai border-t-transparent"></div>
            <p className="mt-4 text-muted-foreground">Cargando alertas...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-6">
            <p className="text-destructive text-center">{error}</p>
          </div>
        )}

        {/* Empty State (Explicitly when no alerts and not loading/generating) */}
        {!loading && !generating && alerts.length === 0 && (
          <div className="card-surface rounded-2xl p-12 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 mx-auto mb-6 gradient-curva rounded-full flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-foreground">Sin alertas activas</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Todo parece estar en orden. Pulsa el botón para realizar un nuevo análisis completo.
            </p>
            <button
              onClick={handleGenerateAlerts}
              className="btn-ai inline-flex items-center gap-2"
            >
              <BrainCircuit className="w-5 h-5" />
              Realizar nuevo análisis
            </button>
          </div>
        )}

        {/* Alerts List */}
        {!loading && !generating && alerts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ai ai-pulse"></span>
              {alerts.length} alerta{alerts.length !== 1 ? "s" : ""} activa{alerts.length !== 1 ? "s" : ""}
            </h2>

            {alerts.map((alert) => {
              const typeConfig = alertTypeConfig[alert.alert_type] || alertTypeConfig.patron_detectado;
              const severityBg = alert.severity === "critical" ? "bg-destructive/10 border-destructive/30" :
                alert.severity === "warning" ? "bg-warning/10 border-warning/30" :
                  "bg-ai/10 border-ai/30";
              const iconBg = typeConfig.color === "destructive" ? "bg-destructive" :
                typeConfig.color === "warning" ? "bg-warning" :
                  typeConfig.color === "ai" ? "bg-ai" :
                    "bg-primary";

              return (
                <div
                  key={alert._id}
                  className={`card-surface rounded-2xl overflow-hidden border ${severityBg} transition-all duration-300 hover:shadow-lg`}
                >
                  {/* Alert Header with gradient */}
                  <div className={`h-1 ${iconBg}`}></div>

                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center shadow-lg text-white`}>
                        {typeConfig.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-lg text-foreground">{alert.title}</h3>
                              <span className={`badge ${alert.severity === "critical" ? "badge-danger" : alert.severity === "warning" ? "badge-warning" : "badge-ai"}`}>
                                {alert.severity === "critical" ? "Crítico" : alert.severity === "warning" ? "Advertencia" : "Info"}
                              </span>
                            </div>
                            {alert.category_name && (
                              <p className="text-sm text-muted-foreground mt-0.5">
                                Categoría: {alert.category_name}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDismissAlert(alert._id)}
                            className="flex-shrink-0 p-2 text-muted-foreground hover:text-foreground hover:bg-card-elevated rounded-lg transition-colors"
                            title="Descartar alerta"
                          >
                            <div className="w-5 h-5 flex items-center justify-center">
                              <Minus className="w-4 h-4" />
                            </div>
                          </button>
                        </div>

                        <p className="mt-3 text-foreground/80 leading-relaxed">
                          {alert.message}
                        </p>

                        {alert.amount_involved !== null && (
                          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-card rounded-lg">
                            <span className="text-sm font-medium text-foreground">
                              {formatCurrency(alert.amount_involved)}
                            </span>
                          </div>
                        )}

                        {alert.recommended_action && (
                          <div className="mt-4 p-4 bg-ai/5 rounded-xl border border-ai/20">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-ai/20 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-ai" />
                              </div>
                              <div>
                                <p className="text-caption text-ai font-medium mb-1">
                                  RECOMENDACIÓN IA
                                </p>
                                <p className="text-sm text-foreground/80">
                                  {alert.recommended_action}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <p className="mt-4 text-xs text-muted-foreground">
                          Generada: {new Date(alert.generated_at).toLocaleString("es-ES", {
                            dateStyle: "medium",
                            timeStyle: "short"
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tips Section (Collapsible) */}
        {!generating && (
          <div className="mt-12">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-4 rounded-xl bg-card hover:bg-card-elevated transition-colors">
                <ChevronsUpDown className="w-5 h-5 text-muted-foreground" />
                <span className="font-semibold text-foreground">Cómo funcionan las alertas inteligentes</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="card-surface rounded-2xl p-8 border border-ai/20 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <ShieldAlert className="w-4 h-4 text-destructive" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Presupuesto excedido</p>
                        <p className="text-sm text-muted-foreground">Te avisa cuando una categoría supera su límite asignado</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                        <TrendingDown className="w-4 h-4 text-warning" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Previsión de déficit</p>
                        <p className="text-sm text-muted-foreground">Predice si te quedarás sin presupuesto antes de fin de mes</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Colchón en peligro</p>
                        <p className="text-sm text-muted-foreground">Alerta cuando tu margen de seguridad está comprometido</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Oportunidad de ahorro</p>
                        <p className="text-sm text-muted-foreground">Sugiere formas de mejorar tu situación financiera</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </main>
    </div>
  );
}
