// API route for AI-powered smart alerts
import { NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import {
  SmartAlert,
  AlertAnalysis,
  CategorySpendingAnalysis,
  Category,
  MonthlyBudget,
  Expense,
  BankTransaction
} from "@/types/database";

// Helper: Get start of current month
function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Helper: Get start of previous month
function getPreviousMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

// Helper: Get end of previous month
function getPreviousMonthEnd(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0);
}

// Helper: Days in current month
function getDaysInMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

// Helper: Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
  }).format(amount);
}

// GET: Fetch all active (non-dismissed) alerts
export async function GET() {
  try {
    console.log("[Alerts API] Fetching active alerts...");

    const alertsResult = await totalumSdk.crud.getRecords<SmartAlert>("smart_alert", {
      filter: [{ is_dismissed: "no" }],
      sort: { generated_at: -1 },
      pagination: { limit: 50, page: 0 }
    });

    const alerts = alertsResult.data || [];
    console.log(`[Alerts API] Found ${alerts.length} active alerts`);

    // Calculate summary
    const summary = {
      criticalCount: alerts.filter(a => a.severity === "critical").length,
      warningCount: alerts.filter(a => a.severity === "warning").length,
      infoCount: alerts.filter(a => a.severity === "info").length,
      totalAlerts: alerts.length
    };

    return NextResponse.json({
      ok: true,
      data: { alerts, summary }
    });

  } catch (error) {
    console.error("[Alerts API] Error fetching alerts:", error);
    return NextResponse.json(
      { ok: false, error: "Error al obtener alertas" },
      { status: 500 }
    );
  }
}

// POST: Generate new AI-powered alerts or perform actions
export async function POST(request: Request) {
  try {
    const body: { action?: string; alertId?: string } = await request.json();
    const { action, alertId } = body;

    // Dismiss an alert
    if (action === "dismiss" && alertId) {
      console.log(`[Alerts API] Dismissing alert: ${alertId}`);
      await totalumSdk.crud.editRecordById("smart_alert", alertId, {
        is_dismissed: "si"
      });
      return NextResponse.json({ ok: true, data: { message: "Alerta descartada" } });
    }

    // Dismiss all alerts
    if (action === "dismiss_all") {
      console.log("[Alerts API] Dismissing all alerts...");
      const alertsResult = await totalumSdk.crud.getRecords<SmartAlert>("smart_alert", {
        filter: [{ is_dismissed: "no" }],
        pagination: { limit: 100, page: 0 }
      });

      for (const alert of alertsResult.data || []) {
        await totalumSdk.crud.editRecordById("smart_alert", alert._id, {
          is_dismissed: "si"
        });
      }
      return NextResponse.json({ ok: true, data: { message: "Todas las alertas descartadas" } });
    }

    // Generate new alerts with AI
    if (action === "generate") {
      console.log("[Alerts API] Generating AI-powered alerts...");

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const today = now.getDate();
      const daysInMonth = getDaysInMonth();
      const daysRemaining = daysInMonth - today;
      const monthStart = getMonthStart();

      // Historical Dates
      const prevMonthStart = getPreviousMonthStart();
      const prevMonthEnd = getPreviousMonthEnd();

      // 1. Fetch budget
      let budget: MonthlyBudget | null = null;
      try {
        const budgetResult = await totalumSdk.crud.getRecords<MonthlyBudget>("monthly_budget", {
          filter: [{ month: currentMonth, year: currentYear }],
          pagination: { limit: 1, page: 0 }
        });
        budget = budgetResult.data?.[0] || null;
        console.log("[Alerts API] Budget:", budget?.total_budget || "not found");
      } catch (err) {
        console.log("[Alerts API] Error fetching budget", err);
      }

      // 2. Fetch categories with their expenses
      let categories: Category[] = [];
      try {
        const categoriesResult = await totalumSdk.crud.getRecords<Category>("category", {
          pagination: { limit: 50, page: 0 }
        });
        categories = categoriesResult.data || [];
        console.log(`[Alerts API] Found ${categories.length} categories`);
      } catch (err) {
        console.log("[Alerts API] Error fetching categories", err);
      }

      // 3. Fetch this month's manual expenses
      let manualExpenses: Expense[] = [];
      try {
        const expensesResult = await totalumSdk.crud.getRecords<Expense>("expense", {
          filter: [{ date: { gte: monthStart } }],
          pagination: { limit: 500, page: 0 }
        });
        manualExpenses = expensesResult.data || [];
        console.log(`[Alerts API] Found ${manualExpenses.length} manual expenses`);
      } catch (err) {
        console.log("[Alerts API] Error fetching expenses", err);
      }

      // 3b. Fetch PREVIOUS month's manual expenses
      let prevManualExpenses: Expense[] = [];
      try {
        const prevExpensesResult = await totalumSdk.crud.getRecords<Expense>("expense", {
          filter: [
            { date: { gte: prevMonthStart } },
            { date: { lte: prevMonthEnd } }
          ],
          pagination: { limit: 500, page: 0 }
        });
        prevManualExpenses = prevExpensesResult.data || [];
      } catch (err) {
        console.log("[Alerts API] Error fetching previous expenses", err);
      }

      // 4. Fetch this month's bank transactions (gastos only)
      let bankTransactions: BankTransaction[] = [];
      try {
        const txResult = await totalumSdk.crud.getRecords<BankTransaction>("bank_transaction", {
          filter: [
            { transaction_type: "gasto" },
            { booking_date: { gte: monthStart } }
          ],
          pagination: { limit: 500, page: 0 }
        });
        bankTransactions = txResult.data || [];
        console.log(`[Alerts API] Found ${bankTransactions.length} bank transactions`);
      } catch (err) {
        console.log("[Alerts API] Error fetching bank transactions", err);
      }

      // 4b. Fetch PREVIOUS month's bank transactions
      let prevBankTransactions: BankTransaction[] = [];
      try {
        const prevTxResult = await totalumSdk.crud.getRecords<BankTransaction>("bank_transaction", {
          filter: [
            { transaction_type: "gasto" },
            { booking_date: { gte: prevMonthStart } },
            { booking_date: { lte: prevMonthEnd } }
          ],
          pagination: { limit: 500, page: 0 }
        });
        prevBankTransactions = prevTxResult.data || [];
      } catch (err) {
        console.log("[Alerts API] Error fetching prev bank transactions", err);
      }

      // 5. Calculate total spending and category breakdown
      const totalBudget = budget?.total_budget || 2000;
      let totalSpent = 0;
      let prevTotalSpent = 0;

      // Calculate spending by category
      const categorySpending: Record<string, number> = {};

      // From manual expenses (Current Month)
      for (const expense of manualExpenses) {
        totalSpent += Math.abs(expense.amount);
        const categoryId = typeof expense.category === "string" ? expense.category : expense.category?._id;
        if (categoryId) {
          categorySpending[categoryId] = (categorySpending[categoryId] || 0) + Math.abs(expense.amount);
        }
      }

      // From bank transactions (Current Month)
      for (const tx of bankTransactions) {
        totalSpent += Math.abs(tx.amount);
        const categoryId = typeof tx.category === "string" ? tx.category : tx.category?._id;
        if (categoryId) {
          categorySpending[categoryId] = (categorySpending[categoryId] || 0) + Math.abs(tx.amount);
        }
      }

      // Calculate Previous Month Total Spent
      for (const expense of prevManualExpenses) prevTotalSpent += Math.abs(expense.amount);
      for (const tx of prevBankTransactions) prevTotalSpent += Math.abs(tx.amount);

      // 6. Build category analysis
      const categoryAnalysis: CategorySpendingAnalysis[] = [];
      for (const category of categories) {
        const categoryBudget = category.type === "fija"
          ? (category.fixed_amount || 0)
          : (totalBudget * (category.percentage || 0) / 100);

        const spent = categorySpending[category._id] || 0;
        const percentageUsed = categoryBudget > 0 ? (spent / categoryBudget) * 100 : 0;
        const isOverBudget = spent > categoryBudget;

        // Project overspend based on current rate
        const dailyRate = today > 0 ? spent / today : 0;
        const projectedTotal = dailyRate * daysInMonth;
        const projectedOverspend = Math.max(0, projectedTotal - categoryBudget);

        categoryAnalysis.push({
          categoryName: category.name,
          budgetAllocated: categoryBudget,
          amountSpent: spent,
          percentageUsed: Math.round(percentageUsed * 10) / 10,
          isOverBudget,
          daysLeft: daysRemaining,
          projectedOverspend: Math.round(projectedOverspend * 100) / 100
        });
      }

      // 7. Calculate predictions
      const dailySpendRate = today > 0 ? totalSpent / today : 0;
      const projectedMonthEnd = totalBudget - (dailySpendRate * daysInMonth);
      const budgetRemaining = totalBudget - totalSpent;

      // Days until we're in danger (less than 10% buffer)
      const safetyThreshold = totalBudget * 0.1;
      let daysUntilDanger: number | null = null;
      if (dailySpendRate > 0 && budgetRemaining > safetyThreshold) {
        daysUntilDanger = Math.floor((budgetRemaining - safetyThreshold) / dailySpendRate);
      } else if (budgetRemaining <= safetyThreshold) {
        daysUntilDanger = 0;
      }

      // Calculate trend compared to last month same day (approx linear)
      // Or just total vs total prev month
      const spendDiffPercent = prevTotalSpent > 0 ? ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100 : 0;
      const trendMessage = prevTotalSpent > 0
        ? `Gasto vs mes anterior (total): ${spendDiffPercent > 0 ? '+' : ''}${Math.round(spendDiffPercent)}%`
        : "Sin datos del mes anterior";

      // 8. Prepare data for AI analysis
      const financialSummary = {
        totalBudget,
        totalSpent,
        budgetRemaining,
        percentageUsed: Math.round((totalSpent / totalBudget) * 1000) / 10,
        dailySpendRate: Math.round(dailySpendRate * 100) / 100,
        daysInMonth,
        daysPassed: today,
        daysRemaining,
        projectedMonthEnd: Math.round(projectedMonthEnd * 100) / 100,
        categories: categoryAnalysis.filter(c => c.amountSpent > 0),
        previousMonth: {
          totalSpent: prevTotalSpent,
          trendMessage
        }
      };

      console.log("[Alerts API] Financial summary:", JSON.stringify(financialSummary, null, 2));

      // 9. Call OpenAI to generate intelligent alerts
      const aiPrompt = `Eres un asesor financiero experto. Analiza estos datos financieros del mes actual y genera alertas inteligentes personalizadas.

DATOS FINANCIEROS:
- Presupuesto total del mes: ${formatCurrency(financialSummary.totalBudget)}
- Gastado hasta ahora: ${formatCurrency(financialSummary.totalSpent)} (${financialSummary.percentageUsed}%)
- Restante: ${formatCurrency(financialSummary.budgetRemaining)}
- Día del mes: ${financialSummary.daysPassed} de ${financialSummary.daysInMonth}
- Días restantes: ${financialSummary.daysRemaining}
- Ritmo de gasto diario: ${formatCurrency(financialSummary.dailySpendRate)}/día
- Proyección fin de mes: ${formatCurrency(financialSummary.projectedMonthEnd)}

CONTEXTO HISTÓRICO:
- Gasto total mes anterior: ${formatCurrency(financialSummary.previousMonth.totalSpent)}
- Tendencia actual: ${financialSummary.previousMonth.trendMessage}

DESGLOSE POR CATEGORÍAS:
${financialSummary.categories.map(c =>
        `- ${c.categoryName}: ${formatCurrency(c.amountSpent)} de ${formatCurrency(c.budgetAllocated)} (${c.percentageUsed}%)${c.isOverBudget ? ' ⚠️ EXCEDIDO' : ''}${c.projectedOverspend > 0 ? ` - Proyección exceso: ${formatCurrency(c.projectedOverspend)}` : ''}`
      ).join('\n')}

INSTRUCCIONES:
Genera un array JSON con alertas financieras. Cada alerta debe tener:
- alert_type: "presupuesto_excedido" | "prevision_deficit" | "patron_detectado" | "colchon_peligro" | "oportunidad_ahorro"
- title: Título corto y claro (máx 50 caracteres)
- message: Explicación detallada del problema (2-3 frases). SI ES RELEVANTE, compáralo con el mes anterior.
- severity: "info" | "warning" | "critical"
- category_name: Categoría afectada o null si es general
- amount_involved: Cantidad relevante o null
- recommended_action: Consejo específico y accionable

REGLAS:
1. Genera máximo 5 alertas, priorizando las más importantes
2. Si una categoría está >80% usa "warning", >100% usa "critical"
3. Si la proyección de fin de mes es negativa, genera alerta "colchon_peligro"
4. Analiza si el usuario está gastando más rápido que el mes anterior y menciónalo si es preocupante.
5. Si todo está bien, genera 1 alerta "oportunidad_ahorro" con consejos de mejora
6. Las alertas deben ser en español, naturales y no alarmistas innecesariamente

Responde SOLO con el array JSON, sin explicaciones adicionales.`;

      let aiAlerts: Partial<SmartAlert>[] = [];

      try {
        const chatBody = {
          messages: [
            {
              content: "Eres un asesor financiero experto que genera alertas inteligentes basadas en datos financieros. Respondes siempre en JSON válido.",
              role: "system"
            },
            {
              content: aiPrompt,
              role: "user"
            }
          ],
          model: "gpt-4.1-mini",
          max_tokens: 1500,
          temperature: 0.7
        };

        console.log("[Alerts API] Calling OpenAI...");
        const aiResult = await totalumSdk.openai.createChatCompletion(chatBody);
        const aiResponse = aiResult.data?.choices?.[0]?.message?.content || "[]";
        console.log("[Alerts API] AI Response:", aiResponse);

        // Parse AI response
        const cleanedResponse = aiResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        aiAlerts = JSON.parse(cleanedResponse);
        console.log(`[Alerts API] AI generated ${aiAlerts.length} alerts`);

      } catch (err) {
        console.error("[Alerts API] AI Error:", err);
        // Generate fallback alerts based on simple rules
        aiAlerts = generateFallbackAlerts(financialSummary, categoryAnalysis);
      }

      // 10. Save alerts to database
      const savedAlerts: SmartAlert[] = [];
      const now_iso = new Date().toISOString();

      for (const alert of aiAlerts) {
        try {
          const newAlert = {
            alert_type: alert.alert_type || "patron_detectado",
            title: alert.title || "Alerta financiera",
            message: alert.message || "",
            severity: alert.severity || "info",
            category_name: alert.category_name || null,
            amount_involved: alert.amount_involved || null,
            recommended_action: alert.recommended_action || "",
            is_dismissed: "no",
            generated_at: now_iso
          };

          const result = await totalumSdk.crud.createRecord("smart_alert", newAlert);
          if (result.data) {
            savedAlerts.push(result.data as SmartAlert);
          }
        } catch (err) {
          console.error("[Alerts API] Error saving alert:", err);
        }
      }

      console.log(`[Alerts API] Saved ${savedAlerts.length} alerts to database`);

      // Build response
      const alertAnalysis = {
        alerts: savedAlerts,
        summary: {
          criticalCount: savedAlerts.filter(a => a.severity === "critical").length,
          warningCount: savedAlerts.filter(a => a.severity === "warning").length,
          infoCount: savedAlerts.filter(a => a.severity === "info").length,
          totalAlerts: savedAlerts.length
        },
        prediction: {
          endOfMonthBalance: Math.round(projectedMonthEnd * 100) / 100,
          riskLevel: projectedMonthEnd < 0 ? "high" : projectedMonthEnd < totalBudget * 0.1 ? "medium" : "low",
          daysUntilDanger,
          safetyMargin: Math.round(budgetRemaining * 100) / 100
        },
        stats: {
          totalBudget,
          totalSpent,
          percentageUsed: financialSummary.percentageUsed,
          previousMonth: financialSummary.previousMonth
        }
      };

      return NextResponse.json({
        ok: true,
        data: alertAnalysis
      });
    }

    return NextResponse.json(
      { ok: false, error: "Acción no válida" },
      { status: 400 }
    );

  } catch (error) {
    console.error("[Alerts API] POST Error:", error);
    return NextResponse.json(
      { ok: false, error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

// Fallback function to generate alerts without AI
function generateFallbackAlerts(
  summary: {
    totalBudget: number;
    totalSpent: number;
    budgetRemaining: number;
    percentageUsed: number;
    dailySpendRate: number;
    daysRemaining: number;
    projectedMonthEnd: number;
  },
  categories: CategorySpendingAnalysis[]
): Partial<SmartAlert>[] {
  const alerts: Partial<SmartAlert>[] = [];

  // Check for over-budget categories
  for (const cat of categories) {
    if (cat.isOverBudget) {
      alerts.push({
        alert_type: "presupuesto_excedido",
        title: `${cat.categoryName}: Presupuesto excedido`,
        message: `Has gastado ${formatCurrency(cat.amountSpent)} de los ${formatCurrency(cat.budgetAllocated)} asignados. Estás ${formatCurrency(cat.amountSpent - cat.budgetAllocated)} por encima del límite.`,
        severity: "critical",
        category_name: cat.categoryName,
        amount_involved: cat.amountSpent - cat.budgetAllocated,
        recommended_action: `Reduce tus gastos en ${cat.categoryName} durante el resto del mes para compensar el exceso.`
      });
    } else if (cat.percentageUsed > 80 && cat.daysLeft > 5) {
      alerts.push({
        alert_type: "prevision_deficit",
        title: `${cat.categoryName}: Ritmo elevado`,
        message: `Ya has usado el ${cat.percentageUsed}% del presupuesto de ${cat.categoryName} y aún quedan ${cat.daysLeft} días. A este ritmo, te pasarás del límite.`,
        severity: "warning",
        category_name: cat.categoryName,
        amount_involved: cat.projectedOverspend,
        recommended_action: `Intenta limitar tus gastos en ${cat.categoryName} a un máximo de ${formatCurrency((cat.budgetAllocated - cat.amountSpent) / cat.daysLeft)} diarios.`
      });
    }
  }

  // Check overall budget projection
  if (summary.projectedMonthEnd < 0) {
    alerts.push({
      alert_type: "colchon_peligro",
      title: "Proyección negativa para fin de mes",
      message: `A tu ritmo actual de gasto (${formatCurrency(summary.dailySpendRate)}/día), terminarás el mes con un déficit de ${formatCurrency(Math.abs(summary.projectedMonthEnd))}.`,
      severity: "critical",
      category_name: null,
      amount_involved: Math.abs(summary.projectedMonthEnd),
      recommended_action: `Reduce tu gasto diario a ${formatCurrency(summary.budgetRemaining / summary.daysRemaining)} para llegar a fin de mes sin déficit.`
    });
  } else if (summary.projectedMonthEnd < summary.totalBudget * 0.1) {
    alerts.push({
      alert_type: "prevision_deficit",
      title: "Colchón de seguridad en riesgo",
      message: `Tu proyección de fin de mes es de solo ${formatCurrency(summary.projectedMonthEnd)}, menos del 10% de tu presupuesto. Es recomendable mantener un colchón mayor.`,
      severity: "warning",
      category_name: null,
      amount_involved: summary.projectedMonthEnd,
      recommended_action: "Considera reducir gastos no esenciales para aumentar tu margen de seguridad."
    });
  }

  // If everything is fine, suggest improvement
  if (alerts.length === 0 && summary.percentageUsed < 70) {
    alerts.push({
      alert_type: "oportunidad_ahorro",
      title: "Excelente control de gastos",
      message: `Llevas gastado solo el ${summary.percentageUsed}% de tu presupuesto. Vas por buen camino para terminar el mes con un excedente de ${formatCurrency(summary.projectedMonthEnd)}.`,
      severity: "info",
      category_name: null,
      amount_involved: summary.projectedMonthEnd,
      recommended_action: "Considera destinar el excedente proyectado a tu fondo de emergencia o inversiones."
    });
  }

  return alerts.slice(0, 5); // Max 5 alerts
}
