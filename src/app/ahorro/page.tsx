"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import type { Savings, SavingsGoal, SavingsMovement, UserSettings } from "@/types/database";

const GOAL_ICONS = ["🎯", "🏠", "✈️", "🚗", "💍", "📱", "🎓", "💻", "🏥", "🎁", "🛡️", "🎮"];

const PRIORITY_LABELS = {
  alta: { label: "Alta", color: "text-red-400", bg: "bg-red-500/10" },
  media: { label: "Media", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  baja: { label: "Baja", color: "text-blue-400", bg: "bg-blue-500/10" },
};

const STATUS_LABELS = {
  activo: { label: "Activo", color: "text-green-400", bg: "bg-green-500/10" },
  pausado: { label: "Pausado", color: "text-gray-400", bg: "bg-gray-500/10" },
  completado: { label: "Completado", color: "text-primary", bg: "bg-primary/10" },
};

export default function AhorroPage() {
  const [savings, setSavings] = useState<Savings | null>(null);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [movements, setMovements] = useState<SavingsMovement[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);

  // Form states
  const [newGoal, setNewGoal] = useState({
    name: "",
    target_amount: 0,
    priority: "media" as "alta" | "media" | "baja",
    icon: "🎯",
    target_date: "",
    notes: "",
  });

  const [assignAmount, setAssignAmount] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [withdrawDescription, setWithdrawDescription] = useState("");

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch user settings
      const settingsRes = await fetch('/api/settings');
      const settingsData = (await settingsRes.json()) as { ok: boolean; data?: UserSettings };
      if (settingsData.ok && settingsData.data) {
        setUserSettings(settingsData.data);
      }

      // Fetch savings with movements
      const savingsRes = await fetch('/api/savings?include_movements=true&movements_limit=20');
      const savingsData = (await savingsRes.json()) as { ok: boolean; data?: { savings: Savings; movements: SavingsMovement[] } };
      console.log("[Ahorro] Fetched savings:", savingsData);
      if (savingsData.ok && savingsData.data) {
        setSavings(savingsData.data.savings);
        setMovements(savingsData.data.movements);
      }

      // Fetch savings goals
      const goalsRes = await fetch('/api/savings-goals');
      const goalsData = (await goalsRes.json()) as { ok: boolean; data?: SavingsGoal[] };
      console.log("[Ahorro] Fetched goals:", goalsData);
      if (goalsData.ok && goalsData.data) {
        setGoals(goalsData.data);
      }
    } catch (error) {
      console.error("[Ahorro] Error fetching data:", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate totals
  const totalAssigned = goals.reduce((sum, g) => sum + (g.current_amount || 0), 0);
  const availableSavings = (savings?.total_balance || 0) - totalAssigned;
  const totalGoalsTarget = goals.filter(g => g.status === "activo").reduce((sum, g) => sum + g.target_amount, 0);
  const overallProgress = totalGoalsTarget > 0 ? (totalAssigned / totalGoalsTarget) * 100 : 0;

  // Handlers
  const handleCreateGoal = async () => {
    try {
      const res = await fetch("/api/savings-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGoal),
      });
      const data = (await res.json()) as { ok: boolean; data?: SavingsGoal };
      console.log("[Ahorro] Created goal:", data);
      if (data.ok) {
        setGoalDialogOpen(false);
        setNewGoal({
          name: "",
          target_amount: 0,
          priority: "media",
          icon: "🎯",
          target_date: "",
          notes: "",
        });
        fetchData();
      }
    } catch (error) {
      console.error("[Ahorro] Error creating goal:", error);
    }
  };

  const handleAssignToGoal = async () => {
    if (!selectedGoal || assignAmount <= 0) return;
    try {
      const res = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movement_type: "asignacion_objetivo",
          amount: assignAmount,
          description: `Asignación a objetivo: ${selectedGoal.name}`,
          source: "ajuste_manual",
          savings_goal_id: selectedGoal._id,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      console.log("[Ahorro] Assigned to goal:", data);
      if (data.ok) {
        setAssignDialogOpen(false);
        setAssignAmount(0);
        setSelectedGoal(null);
        fetchData();
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error("[Ahorro] Error assigning to goal:", error);
    }
  };

  const handleWithdraw = async () => {
    if (withdrawAmount <= 0) return;
    try {
      const res = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movement_type: "salida",
          amount: withdrawAmount,
          description: withdrawDescription || "Retiro de ahorros",
          source: "retiro",
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      console.log("[Ahorro] Withdrew:", data);
      if (data.ok) {
        setWithdrawDialogOpen(false);
        setWithdrawAmount(0);
        setWithdrawDescription("");
        fetchData();
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error("[Ahorro] Error withdrawing:", error);
    }
  };

  const handleUpdateGoalStatus = async (goalId: string, status: "activo" | "pausado" | "completado") => {
    try {
      const res = await fetch("/api/savings-goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: goalId, status }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("[Ahorro] Error updating goal status:", error);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm("¿Eliminar este objetivo? El dinero asignado volverá a estar disponible.")) return;
    try {
      const res = await fetch(`/api/savings-goals?id=${goalId}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("[Ahorro] Error deleting goal:", error);
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
          <p className="text-muted-foreground text-sm">Cargando ahorros...</p>
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
                <span className="text-3xl">🐷</span>
                Mi Hucha
              </h1>
              <p className="text-sm text-muted-foreground">
                Tus ahorros y objetivos financieros
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Main Balance Card */}
        <div className="card-elevated p-8 rounded-2xl mb-6 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative z-10">
            <p className="text-caption text-muted-foreground mb-2">TOTAL AHORRADO</p>
            <p className="text-5xl font-bold text-primary text-glow-primary mb-4">
              {currencySymbol}{formatCurrency(savings?.total_balance || 0)}
            </p>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="p-4 rounded-xl bg-card">
                <p className="text-sm text-muted-foreground">Asignado a objetivos</p>
                <p className="text-xl font-bold text-foreground">
                  {currencySymbol}{formatCurrency(totalAssigned)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-card">
                <p className="text-sm text-muted-foreground">Disponible</p>
                <p className="text-xl font-bold text-green-400">
                  {currencySymbol}{formatCurrency(availableSavings)}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-border">
                    <span className="mr-2">↩️</span> Retirar
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-popover border-border">
                  <DialogHeader>
                    <DialogTitle className="text-white">Retirar de Ahorros</DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Retira dinero de tu hucha. Disponible: {currencySymbol}{formatCurrency(savings?.total_balance || 0)}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Cantidad ({currencySymbol})</Label>
                      <Input
                        type="number"
                        value={withdrawAmount || ""}
                        onChange={(e) => setWithdrawAmount(parseFloat(e.target.value) || 0)}
                        placeholder="100"
                        className="mt-2 bg-muted border-border"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Descripción (opcional)</Label>
                      <Input
                        value={withdrawDescription}
                        onChange={(e) => setWithdrawDescription(e.target.value)}
                        placeholder="Ej: Emergencia médica"
                        className="mt-2 bg-muted border-border"
                      />
                    </div>
                    <Button
                      onClick={handleWithdraw}
                      className="w-full btn-primary"
                      disabled={withdrawAmount <= 0 || withdrawAmount > (savings?.total_balance || 0)}
                    >
                      Retirar {currencySymbol}{formatCurrency(withdrawAmount)}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Link href="/ingresos" className="btn-secondary inline-flex items-center gap-2">
                <span>💰</span> Ver Ingresos
              </Link>
            </div>
          </div>
        </div>

        {/* Goals Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <span>🎯</span>
                Objetivos de Ahorro
              </h2>
              <p className="text-sm text-muted-foreground">
                {goals.filter(g => g.status === "activo").length} objetivos activos
              </p>
            </div>
            <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-primary">
                  <span className="mr-2">+</span> Nuevo Objetivo
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-popover border-border">
                <DialogHeader>
                  <DialogTitle className="text-white">Crear Objetivo de Ahorro</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Define un objetivo claro para tu dinero ahorrado.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Nombre</Label>
                    <Input
                      value={newGoal.name}
                      onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                      placeholder="Ej: Vacaciones 2025"
                      className="mt-2 bg-muted border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Icono</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {GOAL_ICONS.map((icon) => (
                        <button
                          key={icon}
                          onClick={() => setNewGoal({ ...newGoal, icon })}
                          className={`text-xl p-2 rounded-lg border transition-all ${
                            newGoal.icon === icon
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Meta ({currencySymbol})</Label>
                    <Input
                      type="number"
                      value={newGoal.target_amount || ""}
                      onChange={(e) => setNewGoal({ ...newGoal, target_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="5000"
                      className="mt-2 bg-muted border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Prioridad</Label>
                    <Select
                      value={newGoal.priority}
                      onValueChange={(v: "alta" | "media" | "baja") => setNewGoal({ ...newGoal, priority: v })}
                    >
                      <SelectTrigger className="mt-2 bg-muted border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="alta">🔴 Alta</SelectItem>
                        <SelectItem value="media">🟡 Media</SelectItem>
                        <SelectItem value="baja">🔵 Baja</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Fecha objetivo (opcional)</Label>
                    <Input
                      type="date"
                      value={newGoal.target_date}
                      onChange={(e) => setNewGoal({ ...newGoal, target_date: e.target.value })}
                      className="mt-2 bg-muted border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Notas (opcional)</Label>
                    <Input
                      value={newGoal.notes}
                      onChange={(e) => setNewGoal({ ...newGoal, notes: e.target.value })}
                      placeholder="Ej: Para el viaje a Japón"
                      className="mt-2 bg-muted border-border"
                    />
                  </div>
                  <Button
                    onClick={handleCreateGoal}
                    className="w-full btn-primary"
                    disabled={!newGoal.name || !newGoal.target_amount}
                  >
                    Crear Objetivo
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Overall Progress */}
          {goals.length > 0 && (
            <div className="card-surface p-4 rounded-xl mb-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-muted-foreground">Progreso global</p>
                <p className="text-sm font-medium text-foreground">{Math.round(overallProgress)}%</p>
              </div>
              <Progress value={overallProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {currencySymbol}{formatCurrency(totalAssigned)} de {currencySymbol}{formatCurrency(totalGoalsTarget)}
              </p>
            </div>
          )}

          {/* Goals Grid */}
          {goals.length === 0 ? (
            <div className="card-surface p-12 text-center rounded-2xl border border-dashed border-border">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Sin objetivos de ahorro</h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primer objetivo para dar propósito a tus ahorros
              </p>
              <Button onClick={() => setGoalDialogOpen(true)} className="btn-primary">
                Crear Objetivo
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.sort((a, b) => {
                // Sort by priority, then by status
                const priorityOrder = { alta: 0, media: 1, baja: 2 };
                const statusOrder = { activo: 0, pausado: 1, completado: 2 };
                if (statusOrder[a.status] !== statusOrder[b.status]) {
                  return statusOrder[a.status] - statusOrder[b.status];
                }
                return priorityOrder[a.priority] - priorityOrder[b.priority];
              }).map((goal) => {
                const progress = (goal.current_amount / goal.target_amount) * 100;
                const isCompleted = goal.status === "completado" || progress >= 100;

                return (
                  <div
                    key={goal._id}
                    className={`card-surface p-5 rounded-xl group transition-all ${
                      goal.status === "pausado" ? "opacity-60" : ""
                    } ${isCompleted ? "border border-primary/30" : ""}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{goal.icon}</span>
                        <div>
                          <h3 className="font-semibold text-foreground">{goal.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${PRIORITY_LABELS[goal.priority].bg} ${PRIORITY_LABELS[goal.priority].color}`}>
                              {PRIORITY_LABELS[goal.priority].label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_LABELS[goal.status].bg} ${STATUS_LABELS[goal.status].color}`}>
                              {STATUS_LABELS[goal.status].label}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        {goal.status !== "completado" && (
                          <button
                            onClick={() => handleUpdateGoalStatus(goal._id, goal.status === "activo" ? "pausado" : "activo")}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
                            title={goal.status === "activo" ? "Pausar" : "Activar"}
                          >
                            {goal.status === "activo" ? "⏸️" : "▶️"}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteGoal(goal._id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-2xl font-bold text-foreground">
                          {currencySymbol}{formatCurrency(goal.current_amount)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          / {currencySymbol}{formatCurrency(goal.target_amount)}
                        </span>
                      </div>

                      <div className="relative">
                        <Progress value={Math.min(progress, 100)} className="h-2" />
                        {isCompleted && (
                          <div className="absolute -right-1 -top-1 text-sm">✅</div>
                        )}
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{Math.round(progress)}% completado</span>
                        {goal.target_date && (
                          <span className="text-muted-foreground">
                            Meta: {new Date(goal.target_date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" })}
                          </span>
                        )}
                      </div>

                      {goal.notes && (
                        <p className="text-xs text-muted-foreground italic">{goal.notes}</p>
                      )}

                      {goal.status === "activo" && !isCompleted && availableSavings > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2 border-border"
                          onClick={() => {
                            setSelectedGoal(goal);
                            setAssignDialogOpen(true);
                          }}
                        >
                          <span className="mr-2">+</span> Asignar Dinero
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Assign to Goal Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="bg-popover border-border">
            <DialogHeader>
              <DialogTitle className="text-white">
                Asignar a {selectedGoal?.name}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Disponible: {currencySymbol}{formatCurrency(availableSavings)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label className="text-sm text-muted-foreground">Cantidad ({currencySymbol})</Label>
                <Input
                  type="number"
                  value={assignAmount || ""}
                  onChange={(e) => setAssignAmount(parseFloat(e.target.value) || 0)}
                  placeholder="100"
                  className="mt-2 bg-muted border-border"
                />
              </div>
              {selectedGoal && (
                <div className="p-3 rounded-lg bg-card">
                  <p className="text-sm text-muted-foreground">Tras asignar:</p>
                  <p className="text-lg font-bold text-foreground">
                    {currencySymbol}{formatCurrency((selectedGoal.current_amount || 0) + assignAmount)} / {currencySymbol}{formatCurrency(selectedGoal.target_amount)}
                  </p>
                  <Progress
                    value={Math.min(((selectedGoal.current_amount || 0) + assignAmount) / selectedGoal.target_amount * 100, 100)}
                    className="h-2 mt-2"
                  />
                </div>
              )}
              <Button
                onClick={handleAssignToGoal}
                className="w-full btn-primary"
                disabled={assignAmount <= 0 || assignAmount > availableSavings}
              >
                Asignar {currencySymbol}{formatCurrency(assignAmount)}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Movements Section */}
        <div className="card-surface rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span>📜</span>
              Historial de Movimientos
            </h2>
          </div>

          {movements.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Sin movimientos registrados</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {movements.map((movement) => (
                <div key={movement._id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      movement.movement_type === "entrada"
                        ? "bg-green-500/10 text-green-400"
                        : movement.movement_type === "asignacion_objetivo"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-red-500/10 text-red-400"
                    }`}>
                      {movement.movement_type === "entrada" ? "↓" : movement.movement_type === "asignacion_objetivo" ? "🎯" : "↑"}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{movement.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(movement.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      movement.movement_type === "entrada" ? "text-green-400" : "text-red-400"
                    }`}>
                      {movement.movement_type === "entrada" ? "+" : "-"}{currencySymbol}{formatCurrency(movement.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Saldo: {currencySymbol}{formatCurrency(movement.balance_after)}
                    </p>
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
            Consejos de Ahorro
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-card">
              <h4 className="font-semibold mb-1 text-foreground">Objetivos Claros</h4>
              <p className="text-sm text-muted-foreground">
                Un objetivo definido aumenta 3x la probabilidad de ahorro exitoso.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card">
              <h4 className="font-semibold mb-1 text-foreground">Prioriza</h4>
              <p className="text-sm text-muted-foreground">
                Enfócate en 1-2 objetivos de alta prioridad antes de añadir más.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card">
              <h4 className="font-semibold mb-1 text-foreground">Automatiza</h4>
              <p className="text-sm text-muted-foreground">
                Tu regla de distribución mueve dinero al ahorro automáticamente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
