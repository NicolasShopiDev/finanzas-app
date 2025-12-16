"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { BankTransaction, Category } from "@/types/database";
import Link from "next/link";
import { PendingTransactionItem } from "@/components/transactions/PendingTransactionItem";
import { toast } from "sonner";

// API response interface
interface UnassignedResponse {
  ok: boolean;
  data?: {
    transactions: BankTransaction[];
    categories: Category[];
    total: number;
  };
  error?: string;
}

interface UpdateResponse {
  ok: boolean;
  data?: {
    message: string;
    successCount?: number;
    errorCount?: number;
  };
  error?: string;
}

// AI Prediction interfaces
interface CategoryPrediction {
  transactionId: string;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  confidence: "alta" | "media" | "baja";
  reasoning: string;
}

interface AIPredictionResponse {
  ok: boolean;
  data?: {
    predictions: CategoryPrediction[];
    totalProcessed: number;
  };
  error?: string;
}

type SortOption = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export default function MovimientosPendientesPage() {
  // State
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [savingBulk, setSavingBulk] = useState(false);

  // Search & Sort State
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date_desc");

  // AI State
  const [aiPredictions, setAiPredictions] = useState<Record<string, CategoryPrediction>>({});
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(true);

  // Fetch unassigned transactions
  const fetchUnassigned = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/transactions/unassigned?limit=100");
      const data: UnassignedResponse = await res.json();

      if (data.ok && data.data) {
        setTransactions(data.data.transactions);
        setCategories(data.data.categories);
        console.log(`[Movimientos Pendientes] Loaded ${data.data.transactions.length} transactions`);
      }
    } catch (error) {
      console.error("[Movimientos Pendientes] Error fetching:", error);
      toast.error("Error al cargar movimientos");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnassigned();
  }, [fetchUnassigned]);

  // Derived state: Filtered and Sorted Transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          (t.description?.toLowerCase().includes(lowerTerm) || false) ||
          (t.merchant_name?.toLowerCase().includes(lowerTerm) || false) ||
          t.amount.toString().includes(lowerTerm)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "date_desc":
          return new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime();
        case "date_asc":
          return new Date(a.booking_date).getTime() - new Date(b.booking_date).getTime();
        case "amount_desc":
          return b.amount - a.amount;
        case "amount_asc":
          return a.amount - b.amount;
        default:
          return 0;
      }
    });

    return result;
  }, [transactions, searchTerm, sortBy]);

  // Get AI predictions
  const getAIPredictions = async () => {
    if (transactions.length === 0) return;

    setIsLoadingAI(true);
    setAiError(null);

    try {
      const res = await fetch("/api/transactions/ai-categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionIds: transactions.map(tx => tx._id)
        })
      });

      const data: AIPredictionResponse = await res.json();

      if (data.ok && data.data) {
        const predictionsMap: Record<string, CategoryPrediction> = {};
        const newSelectedCategory: Record<string, string> = {};

        data.data.predictions.forEach(pred => {
          predictionsMap[pred.transactionId] = pred;
          if (pred.suggestedCategoryId) {
            newSelectedCategory[pred.transactionId] = pred.suggestedCategoryId;
          }
        });

        setAiPredictions(predictionsMap);
        setSelectedCategory(prev => ({ ...prev, ...newSelectedCategory }));
        toast.success(`${data.data.predictions.length} sugerencias recibidas`);
      } else {
        setAiError(data.error || "Error al obtener predicciones");
        toast.error(data.error || "Error al obtener predicciones");
      }
    } catch (error) {
      console.error("[AI] Error:", error);
      setAiError("Error de conexión");
      toast.error("Error de conexión con IA");
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Accept all AI suggestions
  const acceptAllAISuggestions = async () => {
    const validPredictions = Object.values(aiPredictions).filter(
      pred => pred.suggestedCategoryId
    );

    if (validPredictions.length === 0) {
      toast.message("No hay sugerencias válidas para aplicar");
      return;
    }

    setSavingBulk(true);
    try {
      const assignments = validPredictions.map(pred => ({
        transaction_id: pred.transactionId,
        category_id: pred.suggestedCategoryId
      }));

      const res = await fetch("/api/transactions/unassigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments })
      });

      const data: UpdateResponse = await res.json();

      if (data.ok) {
        toast.success(`Clasificadas ${validPredictions.length} transacciones`);
        const assignedIds = new Set(validPredictions.map(p => p.transactionId));
        setTransactions(prev => prev.filter(t => !assignedIds.has(t._id)));
        setAiPredictions(prev => {
          const newPredictions = { ...prev };
          validPredictions.forEach(p => delete newPredictions[p.transactionId]);
          return newPredictions;
        });
        setSelectedCategory({});
      } else {
        toast.error(data.error || "Error al aplicar sugerencias");
      }
    } catch (error) {
      console.error("[AI] Error:", error);
      toast.error("Error de conexión");
    } finally {
      setSavingBulk(false);
    }
  };

  // Undo assignment
  const handleUndo = async (transaction: BankTransaction) => {
    // Optimistic restore
    setTransactions(prev => [...prev, transaction]);

    // Call API to revert (set category null)
    try {
      const res = await fetch("/api/transactions/unassigned", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: transaction._id, category_id: null })
      });
      const data: UpdateResponse = await res.json();
      if (!data.ok) {
        // Revert optimistic update if failed
        setTransactions(prev => prev.filter(t => t._id !== transaction._id));
        toast.error("No se pudo deshacer la acción");
      }
    } catch (error) {
      setTransactions(prev => prev.filter(t => t._id !== transaction._id));
      toast.error("Error al deshacer");
    }
  };

  // Assign single transaction
  const handleAssign = async (transactionId: string) => {
    const categoryId = selectedCategory[transactionId];
    if (!categoryId) {
      toast.message("Selecciona una categoría");
      return;
    }

    const transaction = transactions.find(t => t._id === transactionId);
    if (!transaction) return;

    setSavingId(transactionId);

    // Optimistic removal
    setTransactions(prev => prev.filter(t => t._id !== transactionId));

    // Show undo toast
    toast.success("Categoría asignada", {
      action: {
        label: "Deshacer",
        onClick: () => handleUndo(transaction)
      }
    });

    try {
      const res = await fetch("/api/transactions/unassigned", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: transactionId, category_id: categoryId })
      });

      const data: UpdateResponse = await res.json();

      if (!data.ok) {
        // Revert optimistic update
        setTransactions(prev => [...prev, transaction]);
        toast.error(data.error || "Error al asignar categoría");
      } else {
        // Cleanup local state
        setSelectedCategory(prev => {
          const newState = { ...prev };
          delete newState[transactionId];
          return newState;
        });
      }
    } catch (error) {
      console.error("[Movimientos] Error assigning:", error);
      setTransactions(prev => [...prev, transaction]); // Revert
      toast.error("Error de conexión");
    } finally {
      setSavingId(null);
    }
  };

  // Skip transaction
  const handleSkip = async (transactionId: string) => {
    // Mark as reviewed/skipped (category_id = null but maybe handled differently in backend? 
    // The original code used category_id: null to "skip/review". usage seems same as unassign really.
    // Assuming backend treats this as "reviewed" or just explicit unassigned.
    // We will just remove it from the list as per original behavior.

    const transaction = transactions.find(t => t._id === transactionId);
    if (!transaction) return;

    setSavingId(transactionId);
    setTransactions(prev => prev.filter(t => t._id !== transactionId));

    toast.message("Transacción saltada", {
      action: {
        label: "Deshacer",
        onClick: () => handleUndo(transaction)
      }
    });

    try {
      const res = await fetch("/api/transactions/unassigned", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Explicitly setting null to ensure it's processed as an update
        body: JSON.stringify({ transaction_id: transactionId, category_id: null })
      });
      const data: UpdateResponse = await res.json();
      if (!data.ok) {
        setTransactions(prev => [...prev, transaction]);
        toast.error(data.error || "Error al actualizar");
      }
    } catch (error) {
      setTransactions(prev => [...prev, transaction]);
      toast.error("Error de conexión");
    } finally {
      setSavingId(null);
    }
  };

  // Bulk assign
  const handleBulkAssign = async () => {
    if (selectedTransactions.size === 0) {
      toast.message("Selecciona al menos una transacción");
      return;
    }

    if (!bulkCategoryId) {
      toast.message("Selecciona una categoría");
      return;
    }

    setSavingBulk(true);
    try {
      const assignments = Array.from(selectedTransactions).map(txId => ({
        transaction_id: txId,
        category_id: bulkCategoryId
      }));

      const res = await fetch("/api/transactions/unassigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments })
      });

      const data: UpdateResponse = await res.json();

      if (data.ok) {
        toast.success("Transacciones actualizadas");
        setTransactions(prev => prev.filter(t => !selectedTransactions.has(t._id)));
        setSelectedTransactions(new Set());
        setBulkCategoryId("");
        setBulkMode(false);
      } else {
        toast.error(data.error || "Error al asignar categorías");
      }
    } catch (error) {
      console.error("[Movimientos] Error bulk:", error);
      toast.error("Error de conexión");
    } finally {
      setSavingBulk(false);
    }
  };

  // Toggle transaction selection
  const toggleSelection = (txId: string) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txId)) newSet.delete(txId);
      else newSet.add(txId);
      return newSet;
    });
  };

  // Select all
  const selectAll = () => {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredTransactions.map(t => t._id)));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full gradient-curva flex items-center justify-center animate-pulse">
            <span className="text-3xl">📋</span>
          </div>
          <p className="text-muted-foreground">Cargando movimientos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass-nav sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-full">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
                  <span className="text-3xl">📋</span>
                  Movimientos Pendientes
                </h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  {transactions.length} transacciones por clasificar
                </p>
              </div>
            </div>

            {transactions.length > 0 && (
              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  onClick={() => {
                    setBulkMode(!bulkMode);
                    if (bulkMode) {
                      setSelectedTransactions(new Set());
                      setBulkCategoryId("");
                    }
                  }}
                  className={`btn-secondary flex items-center gap-2 ${bulkMode ? 'bg-primary/10 text-primary border-primary/30' : ''}`}
                >
                  {bulkMode ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancelar
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Selección múltiple
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Search and Sort Toolbar */}
          {transactions.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-grow">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por concepto o importe..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-4 py-2 bg-muted/50 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm min-w-[160px]"
              >
                <option value="date_desc">📅 Más recientes</option>
                <option value="date_asc">📅 Más antiguos</option>
                <option value="amount_desc">💰 Mayor importe</option>
                <option value="amount_asc">💰 Menor importe</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* AI Assistant Panel */}
        {transactions.length > 0 && showAiPanel && (
          <div className="card-elevated p-6 rounded-2xl mb-6 border border-ai/30 bg-ai/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl gradient-curva flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    Asistente IA
                    <span className="badge badge-ai">Beta</span>
                  </h2>
                </div>
              </div>
              <button
                onClick={() => setShowAiPanel(false)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-card rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={getAIPredictions}
                disabled={isLoadingAI || transactions.length === 0}
                className="btn-ai flex items-center gap-2"
              >
                {isLoadingAI ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analizando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Obtener sugerencias de IA
                  </>
                )}
              </button>

              {Object.keys(aiPredictions).length > 0 && (
                <button
                  onClick={acceptAllAISuggestions}
                  disabled={savingBulk}
                  className="btn-primary flex items-center gap-2"
                >
                  {savingBulk ? "Aplicando..." : `Aceptar todas (${Object.values(aiPredictions).filter(p => p.suggestedCategoryId).length})`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Re-show AI panel button */}
        {!showAiPanel && transactions.length > 0 && (
          <button
            onClick={() => setShowAiPanel(true)}
            className="btn-secondary mb-4 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Mostrar Asistente IA
          </button>
        )}

        {/* Bulk mode toolbar */}
        {bulkMode && transactions.length > 0 && (
          <div className="card-surface p-4 rounded-2xl mb-6 border border-primary/30 bg-primary/5 sticky top-28 z-30 shadow-lg backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button onClick={selectAll} className="btn-secondary text-xs sm:text-sm">
                  {selectedTransactions.size === filteredTransactions.length ? "Deseleccionar todo" : "Seleccionar todo"}
                </button>
                <span className="text-sm font-medium">
                  {selectedTransactions.size} seleccionados
                </span>
              </div>
              <div className="flex items-center gap-3 flex-grow justify-end">
                <select
                  value={bulkCategoryId}
                  onChange={(e) => setBulkCategoryId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-card border border-border text-foreground text-sm max-w-[200px]"
                >
                  <option value="">Seleccionar categoría...</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAssign}
                  disabled={savingBulk || selectedTransactions.size === 0 || !bulkCategoryId}
                  className="btn-primary text-sm whitespace-nowrap"
                >
                  {savingBulk ? "Asignando..." : "Asignar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {filteredTransactions.length === 0 ? (
          // Empty state
          <div className="card-surface border-2 border-dashed border-border rounded-2xl p-16 text-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {searchTerm ? "Sin resultados" : "¡Todo clasificado!"}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {searchTerm
                ? `No se encontraron transacciones que coincidan con "${searchTerm}"`
                : "No tienes movimientos bancarios pendientes de clasificar."}
            </p>
            {!searchTerm && (
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/conectar-banco" className="btn-secondary flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sincronizar banco
                </Link>
                <Link href="/" className="btn-primary flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Ir al dashboard
                </Link>
              </div>
            )}
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="btn-secondary">
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          // Transaction list
          <div className="space-y-4">
            {filteredTransactions.map((tx) => (
              <PendingTransactionItem
                key={tx._id}
                transaction={tx}
                categories={categories}
                isSelected={selectedTransactions.has(tx._id)}
                isBulkMode={bulkMode}
                isSaving={savingId === tx._id}
                hasPrediction={!!aiPredictions[tx._id]?.suggestedCategoryId}
                prediction={aiPredictions[tx._id]}
                selectedProxyCategory={selectedCategory[tx._id]}
                onToggleSelect={toggleSelection}
                onCategorySelectChange={(id, catId) => setSelectedCategory(prev => ({ ...prev, [id]: catId }))}
                onAssign={handleAssign}
                onSkip={handleSkip}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
