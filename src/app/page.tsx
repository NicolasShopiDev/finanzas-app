"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MonthlyBudget, Category, Expense, UserSettings, CurrencyInfo } from "@/types/database";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const CATEGORY_ICONS = ["🏠", "🚗", "🍔", "💡", "📱", "🎬", "👕", "💊", "📚", "✈️", "💰", "🎁", "🛒", "💪", "🎮"];

// Popular currencies for digital nomads
const POPULAR_CURRENCIES: CurrencyInfo[] = [
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', flag: '🇻🇳' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', flag: '🇲🇽' },
  { code: 'COP', name: 'Colombian Peso', symbol: 'COL$', flag: '🇨🇴' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', flag: '🇧🇷' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', flag: '🇵🇭' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', flag: '🇵🇱' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', flag: '🇨🇿' },
];

export default function Main() {
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deletedCategories, setDeletedCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  // Dialog states
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [deletedCategoriesDialogOpen, setDeletedCategoriesDialogOpen] = useState(false);
  const [editCategoryDialogOpen, setEditCategoryDialogOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);

  // Form states
  const [newBudget, setNewBudget] = useState("");
  const [newCategory, setNewCategory] = useState({
    name: "",
    type: "variable" as "fija" | "variable",
    percentage: 0,
    fixed_amount: 0,
    icon: "💰",
  });
  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    category: "",
    currency: "EUR", // Default currency for new expenses
  });
  const [isConverting, setIsConverting] = useState(false);

  // Check if viewing current month
  const isCurrentMonth = selectedMonth === new Date().getMonth() + 1 && selectedYear === new Date().getFullYear();
  const isPastMonth = new Date(selectedYear, selectedMonth - 1) < new Date(new Date().getFullYear(), new Date().getMonth());

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch user settings first
      const settingsRes = await fetch('/api/settings');
      const settingsData = (await settingsRes.json()) as { ok: boolean; data?: UserSettings };
      if (settingsData.ok && settingsData.data) {
        setUserSettings(settingsData.data);
        // Update default expense currency to user's base currency
        setNewExpense(prev => ({ ...prev, currency: settingsData.data!.base_currency.toUpperCase() }));
      }

      const budgetRes = await fetch(`/api/budget?month=${selectedMonth}&year=${selectedYear}`);
      const budgetData = (await budgetRes.json()) as { ok: boolean; data?: MonthlyBudget[] };
      console.log("[Page] Fetched budget:", budgetData);

      if (budgetData.ok && budgetData.data && budgetData.data.length > 0) {
        setBudget(budgetData.data[0]);

        // Fetch categories - now global, with support for historical names
        const forMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        const catRes = await fetch(`/api/categories?for_month=${forMonth}&with_expenses=true`);
        const catData = (await catRes.json()) as { ok: boolean; data?: Category[] };
        console.log("[Page] Fetched categories:", catData);
        if (catData.ok && catData.data) {
          // Separate active and deleted categories
          const activeCategories = catData.data.filter(c => c.is_active === "si" || c.is_active === undefined || c.is_active === null);
          setCategories(activeCategories);
        }

        // Fetch deleted categories separately for the reactivate dialog
        const deletedCatRes = await fetch('/api/categories?include_deleted=true');
        const deletedCatData = (await deletedCatRes.json()) as { ok: boolean; data?: Category[] };
        if (deletedCatData.ok && deletedCatData.data) {
          const deleted = deletedCatData.data.filter(c => c.is_active === "no");
          setDeletedCategories(deleted);
        }

        const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
        const endDate = new Date(selectedYear, selectedMonth, 0).toISOString();
        const expRes = await fetch(`/api/expenses?start_date=${startDate}&end_date=${endDate}`);
        const expData = (await expRes.json()) as { ok: boolean; data?: Expense[] };
        console.log("[Page] Fetched expenses:", expData);
        if (expData.ok && expData.data) {
          setExpenses(expData.data);
        }
      } else {
        setBudget(null);
        // Still fetch categories even without budget - they are global
        const catRes = await fetch('/api/categories');
        const catData = (await catRes.json()) as { ok: boolean; data?: Category[] };
        if (catData.ok && catData.data) {
          const activeCategories = catData.data.filter(c => c.is_active === "si" || c.is_active === undefined || c.is_active === null);
          setCategories(activeCategories);
        }

        // Fetch deleted categories
        const deletedCatRes = await fetch('/api/categories?include_deleted=true');
        const deletedCatData = (await deletedCatRes.json()) as { ok: boolean; data?: Category[] };
        if (deletedCatData.ok && deletedCatData.data) {
          const deleted = deletedCatData.data.filter(c => c.is_active === "no");
          setDeletedCategories(deleted);
        }

        setExpenses([]);
      }
    } catch (error) {
      console.error("[Page] Error fetching data:", error);
    }
    setLoading(false);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate totals
  const totalFixedExpenses = categories
    .filter((c) => c.type === "fija")
    .reduce((sum, c) => sum + (c.fixed_amount || 0), 0);

  const remainingBudget = budget ? budget.total_budget - totalFixedExpenses : 0;

  const totalPercentage = categories
    .filter((c) => c.type === "variable")
    .reduce((sum, c) => sum + (c.percentage || 0), 0);

  const getSpentByCategory = (categoryId: string) => {
    return expenses
      .filter((e) => e.category === categoryId)
      .reduce((sum, e) => sum + e.amount, 0);
  };

  const getCategoryBudget = (category: Category) => {
    if (category.type === "fija") {
      return category.fixed_amount || 0;
    }
    return (remainingBudget * (category.percentage || 0)) / 100;
  };

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Handlers
  const handleCreateBudget = async () => {
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          total_budget: parseFloat(newBudget),
        }),
      });
      const data = (await res.json()) as { ok: boolean; data?: MonthlyBudget };
      console.log("[Page] Created budget:", data);
      if (data.ok) {
        setBudgetDialogOpen(false);
        setNewBudget("");
        fetchData();
      }
    } catch (error) {
      console.error("[Page] Error creating budget:", error);
    }
  };

  const handleCreateCategory = async () => {
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCategory),
      });
      const data = (await res.json()) as { ok: boolean; data?: Category };
      console.log("[Page] Created category:", data);
      if (data.ok) {
        setCategoryDialogOpen(false);
        setNewCategory({ name: "", type: "variable", percentage: 0, fixed_amount: 0, icon: "💰" });
        fetchData();
      }
    } catch (error) {
      console.error("[Page] Error creating category:", error);
    }
  };

  const handleCreateExpense = async () => {
    try {
      setIsConverting(true);
      const baseCurrency = userSettings?.base_currency.toUpperCase() || 'EUR';
      const expenseCurrency = newExpense.currency.toUpperCase();

      // Build expense payload with multi-currency support
      const expensePayload: Record<string, unknown> = {
        description: newExpense.description,
        date: newExpense.date,
        category: newExpense.category,
        // For multi-currency: send original amount and currency
        original_amount: newExpense.amount,
        original_currency: expenseCurrency,
        // The API will handle conversion if currencies differ
        amount: newExpense.amount, // Fallback for backwards compatibility
      };

      console.log("[Page] Creating expense with multi-currency:", expensePayload);

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expensePayload),
      });
      const data = (await res.json()) as { ok: boolean; data?: Expense };
      console.log("[Page] Created expense:", data);
      if (data.ok) {
        setExpenseDialogOpen(false);
        setNewExpense({
          description: "",
          amount: 0,
          date: new Date().toISOString().split("T")[0],
          category: "",
          currency: baseCurrency, // Reset to base currency
        });
        fetchData();
      }
    } catch (error) {
      console.error("[Page] Error creating expense:", error);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      // Soft delete - category will be deactivated, not removed
      const res = await fetch(`/api/categories?id=${categoryId}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("[Page] Error deleting category:", error);
    }
  };

  const handleReactivateCategory = async (categoryId: string) => {
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: categoryId }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        setDeletedCategoriesDialogOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("[Page] Error reactivating category:", error);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const res = await fetch(`/api/expenses?id=${expenseId}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("[Page] Error deleting expense:", error);
    }
  };

  const handleUpdateCategory = async (categoryId: string, updates: Partial<Category>) => {
    try {
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: categoryId, ...updates }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("[Page] Error updating category:", error);
    }
  };

  const handleEditCategorySubmit = async () => {
    if (!categoryToEdit) return;
    try {
      const res = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: categoryToEdit._id,
          name: categoryToEdit.name,
          type: categoryToEdit.type,
          percentage: categoryToEdit.percentage,
          fixed_amount: categoryToEdit.fixed_amount,
          icon: categoryToEdit.icon,
        }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        setEditCategoryDialogOpen(false);
        setCategoryToEdit(null);
        fetchData();
      }
    } catch (error) {
      console.error("[Page] Error updating category:", error);
    }
  };

  // Format currency with symbol from settings
  const formatCurrency = (amount: number, showSymbol = true) => {
    const formatted = new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    if (showSymbol) {
      return `${userSettings?.base_currency_symbol || '€'}${formatted}`;
    }
    return formatted;
  };

  // Format currency for display (without symbol prefix, for use in UI)
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get currency symbol for a code
  const getCurrencySymbol = (code: string) => {
    return POPULAR_CURRENCIES.find(c => c.code === code.toUpperCase())?.symbol || code;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">

        {/* Hero Section with Month Selector */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="min-w-0">
              <p className="text-caption text-muted-foreground mb-1 sm:mb-2">DASHBOARD</p>
              <h1 className="text-2xl sm:text-display gradient-curva-text mb-1 sm:mb-2 truncate">
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Control financiero claro y preciso
              </p>
            </div>

            {/* Month/Year Selectors */}
            <div className="flex gap-2 sm:gap-3 flex-wrap">
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="w-28 sm:w-32 bg-card border-border rounded-xl text-sm sm:text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i} value={(i + 1).toString()}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-20 sm:w-24 bg-card border-border rounded-xl text-sm sm:text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {[2024, 2025, 2026].map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {budget ? (
          <>
            {/* Main Balance Display */}
            <div className="card-surface p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6">
              <div className="flex flex-col gap-4 sm:gap-6">
                <div className="min-w-0">
                  <p className="text-caption text-muted-foreground mb-1">SALDO DISPONIBLE</p>
                  <div className="flex flex-wrap items-baseline gap-1 sm:gap-2">
                    <span className={`text-3xl sm:text-4xl lg:text-5xl font-bold tabular-nums ${totalSpent <= budget.total_budget ? 'text-primary text-glow-primary' : 'text-destructive'
                      }`}>
                      {formatCurrency(budget.total_budget - totalSpent)}
                    </span>
                    <span className="text-muted-foreground text-sm sm:text-lg">
                      / {formatCurrency(budget.total_budget)}
                    </span>
                    <button
                      onClick={() => {
                        setNewBudget(budget.total_budget.toString());
                        setBudgetDialogOpen(true);
                      }}
                      className="ml-2 p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
                      title="Editar presupuesto"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
                  <div className="text-center min-w-0">
                    <p className="text-caption text-muted-foreground mb-1 text-[10px] sm:text-xs">GASTADO</p>
                    <p className="text-base sm:text-xl lg:text-2xl font-semibold text-white tabular-nums truncate">
                      {formatCurrency(totalSpent)}
                    </p>
                  </div>
                  <div className="text-center min-w-0 border-l border-r border-border px-1">
                    <p className="text-caption text-muted-foreground mb-1 text-[10px] sm:text-xs">GASTO FIJO</p>
                    <p className="text-base sm:text-xl lg:text-2xl font-semibold text-white tabular-nums truncate">
                      {formatCurrency(expenses.reduce((sum, e) => {
                        const cat = categories.find(c => c._id === e.category);
                        return (cat?.type === "fija") ? sum + e.amount : sum;
                      }, 0))}
                    </p>
                  </div>
                  <div className="text-center min-w-0">
                    <p className="text-caption text-muted-foreground mb-1 text-[10px] sm:text-xs">GASTO VARIABLE</p>
                    <p className="text-base sm:text-xl lg:text-2xl font-semibold text-white tabular-nums truncate">
                      {formatCurrency(totalSpent - expenses.reduce((sum, e) => {
                        const cat = categories.find(c => c._id === e.category);
                        return (cat?.type === "fija") ? sum + e.amount : sum;
                      }, 0))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 sm:mt-6">
                <div className="flex justify-between text-xs sm:text-sm mb-2">
                  <span className="text-muted-foreground">Uso del presupuesto</span>
                  <span className={`font-medium ${totalSpent > budget.total_budget ? 'text-destructive' : 'text-primary'
                    }`}>
                    {Math.round((totalSpent / budget.total_budget) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${totalSpent > budget.total_budget
                      ? 'bg-destructive glow-error'
                      : totalSpent > budget.total_budget * 0.8
                        ? 'bg-[#FF9F0A] glow-warning'
                        : 'bg-primary glow-primary'
                      }`}
                    style={{ width: `${Math.min((totalSpent / budget.total_budget) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Tabs for Categories and Expenses */}
            <Tabs defaultValue="categories" className="space-y-4 sm:space-y-6">
              <TabsList className="bg-card border border-border p-1 rounded-xl w-full sm:w-auto">
                <TabsTrigger
                  value="categories"
                  className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 sm:px-6 flex-1 sm:flex-none text-sm sm:text-base"
                >
                  Categorías
                </TabsTrigger>
                <TabsTrigger
                  value="expenses"
                  className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 sm:px-6 flex-1 sm:flex-none text-sm sm:text-base"
                >
                  Gastos
                </TabsTrigger>
              </TabsList>

              {/* Categories Tab */}
              <TabsContent value="categories" className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-h1 text-white">Categorías</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {totalPercentage}% de tu dinero variable ({formatCurrency(remainingBudget)}) asignado
                    </p>
                    {isPastMonth && (
                      <p className="text-xs text-cyan-400 mt-1">
                        Viendo mes pasado - nombres históricos mostrados
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {deletedCategories.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => setDeletedCategoriesDialogOpen(true)}
                        className="text-sm border-border hover:bg-card"
                      >
                        Reactivar ({deletedCategories.length})
                      </Button>
                    )}
                    <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="btn-primary text-sm sm:text-base">
                          <span className="mr-2">+</span> Nueva Categoría
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-popover border-border">
                        <DialogHeader>
                          <DialogTitle className="text-white">Nueva Categoría</DialogTitle>
                          <DialogDescription className="text-muted-foreground">
                            Las categorías son globales y aparecen en todos los meses hasta que las desactives.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div>
                            <Label className="text-sm text-muted-foreground">Nombre</Label>
                            <Input
                              value={newCategory.name}
                              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                              placeholder="Ej: Supermercado"
                              className="mt-2 bg-muted border-border"
                            />
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Icono</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {CATEGORY_ICONS.map((icon) => (
                                <button
                                  key={icon}
                                  onClick={() => setNewCategory({ ...newCategory, icon })}
                                  className={`text-xl p-2 rounded-lg border transition-all ${newCategory.icon === icon
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
                            <Label className="text-sm text-muted-foreground">Tipo</Label>
                            <Select value={newCategory.type} onValueChange={(v: "fija" | "variable") => setNewCategory({ ...newCategory, type: v })}>
                              <SelectTrigger className="mt-2 bg-muted border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover border-border">
                                <SelectItem value="fija">Fija (cantidad fija)</SelectItem>
                                <SelectItem value="variable">Variable (% del presupuesto)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {newCategory.type === "fija" ? (
                            <div>
                              <Label className="text-sm text-muted-foreground">
                                Cantidad Fija ({userSettings?.base_currency_symbol || '€'})
                              </Label>
                              <Input
                                type="number"
                                value={newCategory.fixed_amount || ""}
                                onChange={(e) => setNewCategory({ ...newCategory, fixed_amount: parseFloat(e.target.value) || 0 })}
                                placeholder="500"
                                className="mt-2 bg-muted border-border"
                              />
                            </div>
                          ) : (
                            <div>
                              <Label className="text-sm text-muted-foreground">Porcentaje del dinero variable ({formatCurrency(remainingBudget)})</Label>
                              <Input
                                type="number"
                                value={newCategory.percentage || ""}
                                onChange={(e) => setNewCategory({ ...newCategory, percentage: parseFloat(e.target.value) || 0 })}
                                placeholder="15"
                                className="mt-2 bg-muted border-border"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                ≈ {formatCurrency((remainingBudget * (newCategory.percentage || 0)) / 100)}
                              </p>
                            </div>
                          )}
                          <Button onClick={handleCreateCategory} className="w-full btn-primary">
                            Crear Categoría
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {categories.length === 0 ? (
                  <div className="card-surface p-12 text-center border border-dashed border-border">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                      <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-h2 text-white mb-2">Sin categorías</h3>
                    <p className="text-muted-foreground mb-4">Crea tu primera categoría para organizar tus gastos</p>
                    <Button onClick={() => setCategoryDialogOpen(true)} className="btn-primary">
                      Crear Categoría
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...categories].sort((a, b) => {
                      if (a.type === 'fija' && b.type !== 'fija') return -1;
                      if (a.type !== 'fija' && b.type === 'fija') return 1;
                      return 0;
                    }).map((category) => {
                      const categoryBudget = getCategoryBudget(category);
                      const spent = getSpentByCategory(category._id);
                      const percentage = categoryBudget > 0 ? (spent / categoryBudget) * 100 : 0;
                      const isOverBudget = spent > categoryBudget;

                      return (
                        <div
                          key={category._id}
                          className="card-surface p-5 group hover:border-primary/30 transition-all duration-300"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{category.icon}</span>
                              <div>
                                <h3 className="font-medium text-white">{category.name}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${category.type === "fija" ? 'badge-ai' : 'badge-primary'
                                  }`}>
                                  {category.type === "fija" ? "Fija" : `${category.percentage}%`}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setCategoryToEdit({ ...category });
                                  setEditCategoryDialogOpen(true);
                                }}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                                title="Editar categoría"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(category._id)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                                title="Desactivar categoría"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-baseline">
                              <span className={`text-2xl font-bold tabular-nums ${isOverBudget ? 'text-destructive' : 'text-white'}`}>
                                {formatCurrency(spent)}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                / {formatCurrency(categoryBudget)}
                              </span>
                            </div>

                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${isOverBudget
                                  ? 'bg-destructive'
                                  : percentage > 80
                                    ? 'bg-[#FF9F0A]'
                                    : 'bg-primary'
                                  }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              />
                            </div>

                            {category.type === "variable" && (
                              <div className="pt-2 border-t border-border">
                                <div className="flex gap-2 items-center">
                                  <span className="text-xs text-muted-foreground">Ajustar %</span>
                                  <Input
                                    type="number"
                                    className="h-7 w-16 text-xs bg-muted border-border"
                                    defaultValue={category.percentage}
                                    onBlur={(e) => {
                                      const newPercentage = parseFloat(e.target.value);
                                      if (newPercentage !== category.percentage) {
                                        handleUpdateCategory(category._id, { percentage: newPercentage });
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {categories.length > 0 && totalPercentage !== 100 && (
                  <div className={`p-4 rounded-xl ${totalPercentage > 100 ? 'bg-destructive/10 border border-destructive/20' : 'bg-[#FF9F0A]/10 border border-[#FF9F0A]/20'
                    }`}>
                    <p className={`text-sm font-medium ${totalPercentage > 100 ? 'text-destructive' : 'text-[#FF9F0A]'}`}>
                      {totalPercentage > 100
                        ? `Has asignado ${totalPercentage}% del presupuesto variable (${totalPercentage - 100}% de más)`
                        : `Solo has asignado ${totalPercentage}%. Te queda ${100 - totalPercentage}% por asignar.`
                      }
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* Expenses Tab */}
              <TabsContent value="expenses" className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-h1 text-white">Gastos</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {expenses.length} transacciones este mes
                    </p>
                  </div>
                  <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="btn-primary text-sm sm:text-base w-full sm:w-auto" disabled={categories.length === 0}>
                        <span className="mr-2">+</span> Nuevo Gasto
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-popover border-border">
                      <DialogHeader>
                        <DialogTitle className="text-white">Registrar Gasto</DialogTitle>
                        <p className="text-sm text-muted-foreground">
                          Moneda base: {userSettings?.base_currency_symbol || '€'} ({userSettings?.base_currency.toUpperCase() || 'EUR'})
                        </p>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label className="text-sm text-muted-foreground">Descripción</Label>
                          <Input
                            value={newExpense.description}
                            onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                            placeholder="Ej: Compra semanal"
                            className="mt-2 bg-muted border-border"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Moneda</Label>
                          <Select value={newExpense.currency} onValueChange={(v) => setNewExpense({ ...newExpense, currency: v })}>
                            <SelectTrigger className="mt-2 bg-muted border-border">
                              <SelectValue placeholder="Selecciona moneda" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border max-h-60">
                              {POPULAR_CURRENCIES.map((cur) => (
                                <SelectItem key={cur.code} value={cur.code}>
                                  {cur.flag} {cur.code} - {cur.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {newExpense.currency !== (userSettings?.base_currency.toUpperCase() || 'EUR') && (
                            <p className="text-xs text-cyan-400 mt-1">
                              Se convertirá a {userSettings?.base_currency_symbol || '€'} automáticamente
                            </p>
                          )}
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">
                            Cantidad ({POPULAR_CURRENCIES.find(c => c.code === newExpense.currency)?.symbol || newExpense.currency})
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={newExpense.amount || ""}
                            onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                            placeholder="45.50"
                            className="mt-2 bg-muted border-border"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Fecha</Label>
                          <Input
                            type="date"
                            value={newExpense.date}
                            onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                            className="mt-2 bg-muted border-border"
                          />
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Categoría</Label>
                          <Select value={newExpense.category} onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}>
                            <SelectTrigger className="mt-2 bg-muted border-border">
                              <SelectValue placeholder="Selecciona categoría" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              {categories.map((cat) => (
                                <SelectItem key={cat._id} value={cat._id}>
                                  {cat.icon} {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={handleCreateExpense}
                          className="w-full btn-primary"
                          disabled={!newExpense.category || !newExpense.description || !newExpense.amount || isConverting}
                        >
                          {isConverting ? 'Convirtiendo...' : 'Registrar Gasto'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {categories.length === 0 ? (
                  <div className="card-surface p-12 text-center border border-dashed border-border">
                    <p className="text-muted-foreground">Primero debes crear categorías</p>
                  </div>
                ) : expenses.length === 0 ? (
                  <div className="card-surface p-12 text-center border border-dashed border-border">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                      <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h3 className="text-h2 text-white mb-2">Sin gastos registrados</h3>
                    <p className="text-muted-foreground mb-4">Registra tu primer gasto del mes</p>
                    <Button onClick={() => setExpenseDialogOpen(true)} className="btn-primary">
                      Registrar Gasto
                    </Button>
                  </div>
                ) : (
                  <div className="card-surface overflow-hidden">
                    <div className="divide-y divide-border">
                      {expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((expense) => {
                        const category = categories.find((c) => c._id === expense.category);
                        const expenseAny = expense as unknown as Record<string, unknown>;
                        const originalCurrency = expenseAny.original_currency as string | undefined;
                        const originalAmount = expenseAny.original_amount as number | undefined;
                        const baseCurrency = userSettings?.base_currency.toUpperCase() || 'EUR';
                        const showOriginalCurrency = originalCurrency && originalCurrency !== baseCurrency && originalAmount;

                        return (
                          <div
                            key={expense._id}
                            className="flex items-center justify-between p-3 sm:p-4 hover:bg-white/[0.02] transition-colors group"
                          >
                            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                              <span className="text-xl sm:text-2xl flex-shrink-0">{category?.icon || "💰"}</span>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-white text-sm sm:text-base truncate">{expense.description}</p>
                                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                  {category?.name || "Sin categoría"} • {new Date(expense.date).toLocaleDateString("es-ES", {
                                    day: "numeric",
                                    month: "short"
                                  })}
                                  {showOriginalCurrency && (
                                    <span className="ml-1 sm:ml-2 text-cyan-400">
                                      ({getCurrencySymbol(originalCurrency)}{formatAmount(originalAmount)})
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 ml-2">
                              <span className="font-semibold text-sm sm:text-lg text-white tabular-nums">
                                -{formatCurrency(expense.amount)}
                              </span>
                              <button
                                onClick={() => handleDeleteExpense(expense._id)}
                                className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          /* No Budget State */
          <div className="card-surface p-16 text-center border border-dashed border-border">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full gradient-curva flex items-center justify-center">
              <svg className="w-10 h-10 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-h1 text-white mb-2">Configura tu presupuesto</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Define un presupuesto para {MONTH_NAMES[selectedMonth - 1]} {selectedYear} y empieza a tomar el control de tus finanzas
            </p>
            <Button
              onClick={() => {
                setNewBudget("");
                setBudgetDialogOpen(true);
              }}
              className="btn-primary text-lg px-8 py-4"
            >
              Crear Presupuesto
            </Button>
          </div>
        )}
      </div>

      {/* Budget Dialog */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent className="bg-popover border-border">
          <DialogHeader>
            <DialogTitle className="text-white">
              {budget ? "Editar Presupuesto" : "Nuevo Presupuesto"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Define el presupuesto total para {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-sm text-muted-foreground">
                Presupuesto Total ({userSettings?.base_currency_symbol || '€'})
              </Label>
              <Input
                type="number"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                placeholder="2500"
                className="mt-2 bg-muted border-border text-2xl font-bold h-14"
              />
            </div>
            <Button onClick={handleCreateBudget} className="w-full btn-primary">
              {budget ? "Actualizar Presupuesto" : "Crear Presupuesto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deleted Categories Dialog */}
      <Dialog open={deletedCategoriesDialogOpen} onOpenChange={setDeletedCategoriesDialogOpen}>
        <DialogContent className="bg-popover border-border">
          <DialogHeader>
            <DialogTitle className="text-white">Categorías Desactivadas</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Reactiva categorías que hayas eliminado anteriormente. Su historial se mantiene intacto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4 max-h-96 overflow-y-auto">
            {deletedCategories.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No hay categorías desactivadas</p>
            ) : (
              deletedCategories.map((cat) => (
                <div
                  key={cat._id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <div>
                      <p className="font-medium text-white">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cat.type === "fija" ? `Fija: ${formatCurrency(cat.fixed_amount || 0)}` : `Variable: ${cat.percentage}%`}
                      </p>
                      {cat.deleted_at && (
                        <p className="text-xs text-destructive/80">
                          Eliminada: {new Date(cat.deleted_at).toLocaleDateString("es-ES")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReactivateCategory(cat._id)}
                    className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    Reactivar
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={editCategoryDialogOpen} onOpenChange={(open) => {
        setEditCategoryDialogOpen(open);
        if (!open) setCategoryToEdit(null);
      }}>
        <DialogContent className="bg-popover border-border">
          <DialogHeader>
            <DialogTitle className="text-white">Editar Categoría</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Los cambios de nombre se guardan en el historial. El pasado no se modifica.
            </DialogDescription>
          </DialogHeader>
          {categoryToEdit && (
            <div className="space-y-4 pt-4">
              <div>
                <Label className="text-sm text-muted-foreground">Nombre</Label>
                <Input
                  value={categoryToEdit.name}
                  onChange={(e) => setCategoryToEdit({ ...categoryToEdit, name: e.target.value })}
                  placeholder="Ej: Supermercado"
                  className="mt-2 bg-muted border-border"
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Icono</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {CATEGORY_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setCategoryToEdit({ ...categoryToEdit, icon })}
                      className={`text-xl p-2 rounded-lg border transition-all ${categoryToEdit.icon === icon
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
                <Label className="text-sm text-muted-foreground">Tipo</Label>
                <Select
                  value={categoryToEdit.type}
                  onValueChange={(v: "fija" | "variable") => setCategoryToEdit({ ...categoryToEdit, type: v })}
                >
                  <SelectTrigger className="mt-2 bg-muted border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="fija">Fija (cantidad fija)</SelectItem>
                    <SelectItem value="variable">Variable (% del presupuesto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {categoryToEdit.type === "fija" ? (
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Cantidad Fija ({userSettings?.base_currency_symbol || '€'})
                  </Label>
                  <Input
                    type="number"
                    value={categoryToEdit.fixed_amount || ""}
                    onChange={(e) => setCategoryToEdit({ ...categoryToEdit, fixed_amount: parseFloat(e.target.value) || 0 })}
                    placeholder="500"
                    className="mt-2 bg-muted border-border"
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-sm text-muted-foreground">Porcentaje del dinero variable</Label>
                  <Input
                    type="number"
                    value={categoryToEdit.percentage || ""}
                    onChange={(e) => setCategoryToEdit({ ...categoryToEdit, percentage: parseFloat(e.target.value) || 0 })}
                    placeholder="15"
                    className="mt-2 bg-muted border-border"
                  />
                </div>
              )}
              <Button onClick={handleEditCategorySubmit} className="w-full btn-primary">
                Guardar Cambios
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
