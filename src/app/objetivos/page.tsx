"use client";

import { useState, useEffect, useCallback } from "react";
import { GamificationData } from "@/types/database";
import Link from "next/link";

interface GamificationResponse {
  ok: boolean;
  data?: GamificationData;
  error?: string;
}

export default function ObjetivosPage() {
  const [data, setData] = useState<GamificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStreak, setIsUpdatingStreak] = useState(false);
  const [isGeneratingMission, setIsGeneratingMission] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/gamification");
      const result: GamificationResponse = await res.json();
      if (result.ok && result.data) {
        setData(result.data);
        console.log("[Objetivos] Data loaded:", result.data);
      }
    } catch (error) {
      console.error("[Objetivos] Error fetching:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateStreak = async () => {
    setIsUpdatingStreak(true);
    try {
      await fetch("/api/gamification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_streak" })
      });
      await fetchData();
    } catch (error) {
      console.error("[Objetivos] Error updating streak:", error);
    } finally {
      setIsUpdatingStreak(false);
    }
  };

  const generateMission = async () => {
    setIsGeneratingMission(true);
    try {
      await fetch("/api/gamification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_mission" })
      });
      await fetchData();
    } catch (error) {
      console.error("[Objetivos] Error generating mission:", error);
    } finally {
      setIsGeneratingMission(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR"
    }).format(amount);
  };

  const getMissionLabel = (type: string) => {
    const labels: Record<string, string> = {
      reduce_food: "Reduce gastos en comida",
      reduce_transport: "Reduce gastos de transporte",
      reduce_entertainment: "Reduce gastos de ocio",
      reduce_clothing: "Reduce gastos en ropa",
      increase_savings: "Aumenta tu ahorro"
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full gradient-curva flex items-center justify-center animate-pulse">
            <span className="text-3xl">🎯</span>
          </div>
          <p className="text-muted-foreground">Cargando objetivos...</p>
        </div>
      </div>
    );
  }

  const { streak, mission, prediction, thermometer } = data || {
    streak: null,
    mission: null,
    prediction: { predictedRunOutDay: null, currentSpendRate: 0, projectedMonthEnd: 0, daysRemaining: 0, budgetRemaining: 0, isOnTrack: true },
    thermometer: { percentage: 0, budgetTotal: 0, budgetUsed: 0, budgetRemaining: 0, status: "good" as const }
  };

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
                <span className="text-3xl">🎯</span>
                Mis Objetivos
              </h1>
              <p className="text-sm text-muted-foreground">
                Seguimiento de tu progreso financiero
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-2">

          {/* 1. TERMÓMETRO DEL MES - Objetivo Visual Principal */}
          <div className="lg:col-span-2 card-elevated p-6 sm:p-8 rounded-3xl overflow-hidden shadow-sm">
            <div className="mb-8">
              <h2 className="text-h1 font-semibold flex items-center gap-3 text-foreground">
                <span className="text-3xl">🌡️</span>
                Termómetro del Mes
              </h2>
              <p className="text-base text-muted-foreground mt-2 leading-relaxed">
                Visualiza tu presupuesto de un vistazo
              </p>
            </div>
            <div className="space-y-8">
              {/* Thermometer Visual */}
              <div className="relative">
                <div className="h-12 rounded-full bg-border overflow-hidden relative">
                  {/* Fill bar */}
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out relative ${thermometer.status === "danger"
                      ? "bg-destructive"
                      : thermometer.status === "warning"
                        ? "bg-warning"
                        : "bg-primary"
                      }`}
                    style={{ width: `${Math.min(thermometer.percentage, 100)}%` }}
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 shimmer" />
                  </div>

                  {/* Day marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-foreground/50"
                    style={{ left: `${(new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100}%` }}
                  />
                </div>

                {/* Labels */}
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-muted-foreground">0%</span>
                  <span className={`font-bold text-lg ${thermometer.status === "danger" ? "text-destructive" :
                    thermometer.status === "warning" ? "text-warning" :
                      "text-primary text-glow-primary"
                    }`}>
                    {thermometer.percentage.toFixed(1)}% usado
                  </span>
                  <span className="text-muted-foreground">100%</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="text-center p-5 rounded-2xl bg-card border border-border/50">
                  <p className="text-xs font-medium text-muted-foreground mb-2 tracking-wider">PRESUPUESTO</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(thermometer.budgetTotal)}</p>
                </div>
                <div className="text-center p-5 rounded-2xl bg-destructive/5 border border-destructive/10">
                  <p className="text-xs font-medium text-muted-foreground mb-2 tracking-wider">GASTADO</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(thermometer.budgetUsed)}</p>
                </div>
                <div className={`text-center p-5 rounded-2xl border ${thermometer.budgetRemaining >= 0 ? "bg-primary/5 border-primary/10" : "bg-destructive/5 border-destructive/10"}`}>
                  <p className="text-xs font-medium text-muted-foreground mb-2 tracking-wider">DISPONIBLE</p>
                  <p className={`text-2xl font-bold ${thermometer.budgetRemaining >= 0 ? "text-primary" : "text-destructive"}`}>
                    {formatCurrency(thermometer.budgetRemaining)}
                  </p>
                </div>
              </div>

              {/* Status message */}
              <div className={`p-6 rounded-2xl flex items-start gap-4 border ${thermometer.status === "danger"
                ? "bg-destructive/10 border-destructive/20"
                : thermometer.status === "warning"
                  ? "bg-warning/10 border-warning/20"
                  : "bg-primary/10 border-primary/20"
                }`}>
                <span className="text-3xl mt-1">
                  {thermometer.status === "danger" ? "⚠️" : thermometer.status === "warning" ? "⚡" : "✨"}
                </span>
                <div>
                  <p className={`text-lg font-semibold mb-1 ${thermometer.status === "danger" ? "text-destructive" :
                    thermometer.status === "warning" ? "text-warning" :
                      "text-primary"
                    }`}>
                    {thermometer.status === "danger"
                      ? "Estás gastando más de lo planeado"
                      : thermometer.status === "warning"
                        ? "Cuidado, te acercas al límite"
                        : "¡Vas por buen camino!"}
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {thermometer.status === "danger"
                      ? "Considera reducir gastos variables esta semana para equilibrar tu mes."
                      : thermometer.status === "warning"
                        ? "Mantén el ritmo actual para llegar bien a fin de mes."
                        : "Sigue así y cumplirás tu objetivo mensual sin problemas."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. RACHA DE DÍAS SIN GASTO */}
          <div className="card-surface p-6 sm:p-8 rounded-3xl overflow-hidden shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-h2 font-semibold flex items-center gap-3 text-foreground">
                  <span className="text-3xl">🔥</span>
                  Racha Sin Gastos
                </h2>
                <p className="text-base text-muted-foreground mt-2">
                  Días consecutivos sin gastos variables
                </p>
              </div>
              <button
                onClick={updateStreak}
                disabled={isUpdatingStreak}
                className="btn-secondary text-sm px-4 py-2"
              >
                {isUpdatingStreak ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  "Actualizar"
                )}
              </button>
            </div>
            {streak ? (
              <div className="space-y-8 flex-grow flex flex-col justify-between">
                {/* Main streak counter */}
                <div className="text-center py-6">
                  <div className="relative inline-block">
                    <div className={`text-8xl sm:text-9xl font-black transition-all ${streak.current_streak > 0 ? "text-warning text-glow-warning scale-110" : "text-muted-foreground"
                      }`}>
                      {streak.current_streak}
                    </div>
                    {streak.current_streak > 0 && (
                      <div className="absolute -top-4 -right-4 text-4xl animate-bounce">
                        🔥
                      </div>
                    )}
                  </div>
                  <p className="text-xl text-muted-foreground mt-4 font-medium">
                    {streak.current_streak === 1 ? "día sin gastar" : "días sin gastar"}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-2xl bg-card border border-border/50">
                    <p className="text-2xl font-bold text-primary">{streak.best_streak}</p>
                    <p className="text-xs text-muted-foreground mt-1">Mejor racha</p>
                  </div>
                  <div className="text-center p-4 rounded-2xl bg-card border border-border/50">
                    <p className="text-2xl font-bold text-primary">{streak.total_no_spend_days}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total días</p>
                  </div>
                  <div className="text-center p-4 rounded-2xl bg-card border border-border/50">
                    <p className="text-2xl font-bold text-muted-foreground">{streak.streak_broken_count}</p>
                    <p className="text-xs text-muted-foreground mt-1">Veces rota</p>
                  </div>
                </div>

                {/* Motivation message */}
                <div className="p-5 rounded-2xl bg-warning/5 border border-warning/20">
                  <p className="text-base text-foreground text-center font-medium">
                    {streak.current_streak === 0
                      ? "💪 Empieza hoy una nueva racha. ¡Tú puedes!"
                      : streak.current_streak < streak.best_streak
                        ? `🎯 Te faltan ${streak.best_streak - streak.current_streak} días para superar tu récord`
                        : "🏆 ¡Estás en tu mejor racha! Sigue así"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 rounded-full bg-card flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">🔥</span>
                </div>
                <p className="text-lg text-muted-foreground mb-6">
                  Aún no has iniciado tu racha
                </p>
                <button onClick={updateStreak} disabled={isUpdatingStreak} className="btn-primary w-full sm:w-auto">
                  Iniciar Racha
                </button>
              </div>
            )}
          </div>

          {/* 3. PREDICCIÓN DE FIN DE MES */}
          <div className="card-surface p-6 sm:p-8 rounded-3xl overflow-hidden shadow-sm flex flex-col h-full">
            <div className="mb-8">
              <h2 className="text-h2 font-semibold flex items-center gap-3 text-foreground">
                <span className="text-3xl">🔮</span>
                Predicción IA
                <span className="w-2.5 h-2.5 rounded-full bg-ai ai-pulse"></span>
              </h2>
              <p className="text-base text-muted-foreground mt-2">
                Pronóstico basado en tu ritmo de gasto actual
              </p>
            </div>
            <div className="space-y-8 flex-grow">
              {/* Main prediction */}
              <div className={`p-8 rounded-2xl text-center border transition-all ${prediction.budgetRemaining < 0
                ? "bg-destructive/5 border-destructive/20"
                : prediction.isOnTrack
                  ? "bg-primary/5 border-primary/20"
                  : "bg-warning/5 border-warning/20"
                }`}>
                {prediction.budgetRemaining < 0 ? (
                  <>
                    <p className="text-base text-muted-foreground mb-3 font-medium">Presupuesto Excedido</p>
                    <p className="text-5xl sm:text-6xl font-black text-destructive text-glow-destructive tracking-tight">
                      {formatCurrency(Math.abs(prediction.budgetRemaining))}
                    </p>
                    <p className="text-base text-muted-foreground mt-4 leading-relaxed">
                      ⚠️ Has superado tu límite mensual
                    </p>
                  </>
                ) : prediction.predictedRunOutDay ? (
                  <>
                    <p className="text-base text-muted-foreground mb-3 font-medium">Tu presupuesto se agotará el</p>
                    <p className="text-5xl sm:text-6xl font-black text-destructive text-glow-destructive tracking-tight">
                      Día {prediction.predictedRunOutDay}
                    </p>
                    <p className="text-base text-muted-foreground mt-4 bg-card/50 inline-block px-4 py-1 rounded-full border border-border/50">
                      🎯 Meta: Llegar al día 30
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base text-muted-foreground mb-3 font-medium">Llegarás a fin de mes con</p>
                    <p className="text-5xl sm:text-6xl font-black text-primary text-glow-primary tracking-tight">
                      {formatCurrency(Math.max(0, prediction.projectedMonthEnd))}
                    </p>
                    <p className="text-base text-muted-foreground mt-4 bg-primary/10 inline-block px-4 py-1 rounded-full text-primary font-medium">
                      ✨ ¡Vas por buen camino!
                    </p>
                  </>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <div className="p-5 rounded-2xl bg-card border border-border/50 text-center">
                  <p className="text-xs font-medium text-muted-foreground tracking-wider mb-2">GASTO DIARIO</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(prediction.currentSpendRate)}</p>
                  <p className="text-xs text-muted-foreground mt-1">promedio</p>
                </div>
                <div className="p-5 rounded-2xl bg-card border border-border/50 text-center">
                  <p className="text-xs font-medium text-muted-foreground tracking-wider mb-2">DÍAS RESTANTES</p>
                  <p className="text-2xl font-bold text-foreground">{prediction.daysRemaining}</p>
                  <p className="text-xs text-muted-foreground mt-1">este mes</p>
                </div>
              </div>

              {/* Challenge */}
              {(prediction.predictedRunOutDay || prediction.budgetRemaining < 0) && (
                <div className={`p-6 rounded-2xl border ${prediction.budgetRemaining < 0
                  ? "bg-destructive/5 border-destructive/20"
                  : "bg-ai/5 border-ai/20"
                  }`}>
                  <p className={`text-lg font-bold flex items-center gap-2 mb-2 ${prediction.budgetRemaining < 0 ? "text-destructive" : "text-ai"
                    }`}>
                    <span className="text-2xl">{prediction.budgetRemaining < 0 ? "🛡️" : "⚡"}</span>
                    {prediction.budgetRemaining < 0 ? "Objetivo: Control de daños" : "Desafío: Supera la predicción"}
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    {prediction.budgetRemaining < 0 ? (
                      "Tu meta ahora es minimizar gastos variables y evitar más fugas de dinero."
                    ) : (
                      <>
                        Reduce tu gasto diario a menos de{" "}
                        <strong className="text-foreground px-1 bg-white/5 rounded">
                          {formatCurrency(Math.max(0, prediction.budgetRemaining / Math.max(1, prediction.daysRemaining)))}
                        </strong>{" "}
                        para llegar a fin de mes.
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 4. MISIÓN SEMANAL */}
          <div className="lg:col-span-2 card-elevated p-6 sm:p-8 rounded-3xl overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-h1 font-semibold flex items-center gap-3 text-foreground">
                  <span className="text-3xl">🎯</span>
                  Misión de la Semana
                </h2>
                <p className="text-base text-muted-foreground mt-2">
                  Un objetivo, máximo foco
                </p>
              </div>
              {!mission && (
                <button onClick={generateMission} disabled={isGeneratingMission} className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
                  {isGeneratingMission ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Nueva Misión
                    </>
                  )}
                </button>
              )}
            </div>
            {mission ? (
              <div className="space-y-8">
                {/* Mission card */}
                <div className="p-6 sm:p-8 rounded-2xl border border-border bg-card/30">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-3xl shadow-sm">
                      {mission.mission_type === "reduce_food" ? "🛒" :
                        mission.mission_type === "reduce_transport" ? "🚗" :
                          mission.mission_type === "reduce_entertainment" ? "🎬" :
                            mission.mission_type === "reduce_clothing" ? "👕" : "💰"}
                    </div>
                    <div className="flex-grow space-y-2">
                      <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${mission.status === "completed"
                          ? "bg-green-500/10 text-green-500 border-green-500/20"
                          : mission.status === "failed"
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : "bg-primary/10 text-primary border-primary/20"}`}>
                          {mission.status === "active" ? "En curso" : mission.status === "completed" ? "Completada" : "Fallida"}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-foreground leading-tight">
                        {getMissionLabel(mission.mission_type)}
                      </h3>
                      <p className="text-base text-muted-foreground">
                        Meta: Gastar menos de <span className="font-semibold text-foreground">{formatCurrency(mission.previous_week_amount * (1 - mission.target_percentage / 100))}</span>
                      </p>
                    </div>
                  </div>

                  {/* Simplified Progress */}
                  <div className="mt-8">
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Gastado</p>
                        <p className="text-2xl font-bold text-foreground">{formatCurrency(mission.current_week_amount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Límite</p>
                        <p className="text-xl font-medium text-muted-foreground">{formatCurrency(mission.previous_week_amount * (1 - mission.target_percentage / 100))}</p>
                      </div>
                    </div>

                    {/* Simple Bar */}
                    <div className="h-4 bg-secondary/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${mission.current_week_amount > mission.previous_week_amount * (1 - mission.target_percentage / 100)
                          ? "bg-destructive"
                          : "bg-primary"
                          }`}
                        style={{
                          width: `${Math.min(100, (mission.current_week_amount / (mission.previous_week_amount * (1 - mission.target_percentage / 100))) * 100)}%`
                        }}
                      />
                    </div>

                    {/* Remaining / Status Message */}
                    <div className="mt-4 flex items-center justify-center gap-2">
                      {mission.current_week_amount > mission.previous_week_amount * (1 - mission.target_percentage / 100) ? (
                        <>
                          <span className="text-destructive font-bold">⚠️ Excedido por {formatCurrency(mission.current_week_amount - (mission.previous_week_amount * (1 - mission.target_percentage / 100)))}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground">Te quedan</span>
                          <span className="text-primary font-bold text-lg">{formatCurrency((mission.previous_week_amount * (1 - mission.target_percentage / 100)) - mission.current_week_amount)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* New mission button */}
                <div className="flex justify-center pt-2">
                  <button onClick={generateMission} disabled={isGeneratingMission} className="btn-secondary flex items-center gap-2 hover:bg-muted/80 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Generar nueva misión
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-24 h-24 rounded-full gradient-curva flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <span className="text-5xl">🎯</span>
                </div>
                <h3 className="text-2xl font-bold mb-3 text-foreground">Sin misión activa</h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto text-lg leading-relaxed">
                  Genera una misión semanal para tener un objetivo claro y medible.
                  Solo una misión a la vez = máximo foco.
                </p>
                <button onClick={generateMission} disabled={isGeneratingMission} className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generar mi primera misión
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tips section */}
        <div className="mt-8 card-surface p-6 sm:p-8 rounded-3xl shadow-sm">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-3 text-foreground">
            <svg className="w-6 h-6 text-ai" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Cómo funcionan los objetivos
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-2xl bg-card border border-border/50">
              <div className="text-3xl mb-3">🌡️</div>
              <h4 className="font-semibold mb-2 text-foreground">Termómetro</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Visualiza tu presupuesto al instante. Verde = bien, Amarillo = cuidado, Rojo = peligro.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-card border border-border/50">
              <div className="text-3xl mb-3">🔥</div>
              <h4 className="font-semibold mb-2 text-foreground">Rachas</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cada día sin gastos variables suma. Tu cerebro odia perder progresos.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-card border border-border/50">
              <div className="text-3xl mb-3">🔮</div>
              <h4 className="font-semibold mb-2 text-foreground">Predicción</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                La IA predice cuándo se agota tu presupuesto. Tu meta: superarla.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-card border border-border/50">
              <div className="text-3xl mb-3">🎯</div>
              <h4 className="font-semibold mb-2 text-foreground">Misiones</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Una misión por semana. Foco extremo = resultados reales.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
