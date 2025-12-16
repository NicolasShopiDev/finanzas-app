// API route for gamification features
import { NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import {
  UserStreak,
  WeeklyMission,
  MonthPrediction,
  GamificationData,
  BankTransaction,
  MonthlyBudget,
  Expense,
  Category
} from "@/types/database";

// Helper: Get start of current month
function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Helper: Get start of current week (Monday)
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.getFullYear(), now.getMonth(), diff);
}

// Helper: Get end of current week (Sunday)
function getWeekEnd(): Date {
  const weekStart = getWeekStart();
  return new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
}

// Helper: Days in current month
function getDaysInMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

// GET: Fetch all gamification data
export async function GET() {
  try {
    console.log("[Gamification API] Fetching gamification data...");

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const today = now.getDate();
    const daysInMonth = getDaysInMonth();
    const daysRemaining = daysInMonth - today;

    // 1. Fetch user streak
    let streak: UserStreak | null = null;
    try {
      const streakResult = await totalumSdk.crud.getRecords<UserStreak>("user_streak", {
        pagination: { limit: 1, page: 0 }
      });
      streak = streakResult.data?.[0] || null;
      console.log("[Gamification API] Streak data:", streak ? "found" : "not found");
    } catch (err) {
      console.log("[Gamification API] No streak data yet", err);
    }

    // 2. Fetch active weekly mission
    let mission: WeeklyMission | null = null;
    try {
      const missionResult = await totalumSdk.crud.getRecords<WeeklyMission>("weekly_mission", {
        filter: [{ status: "active" }],
        sort: { week_start: -1 },
        pagination: { limit: 1, page: 0 }
      });
      mission = missionResult.data?.[0] || null;
      console.log("[Gamification API] Mission data:", mission ? "found" : "not found");

      // Calculate current progress dynamically if mission is active
      if (mission && mission.status === "active") {
        try {
          // 1. Find the category id for the mission
          const catResult = await totalumSdk.crud.getRecords<Category>("category", {
            filter: [{ name: mission.category_name }],
            pagination: { limit: 1, page: 0 }
          });

          const category = catResult.data?.[0];

          if (category) {
            const missionStart = new Date(mission.week_start);
            const missionEnd = new Date(mission.week_end);
            let currentAmount = 0;

            // 2. Sum manual expenses for this category in the time range
            // We use inclusive filtering in query and strict in memory
            const expResult = await totalumSdk.crud.getRecords<Expense>("expense", {
              filter: [
                { category: category._id },
                { date: { gte: missionStart } },
                { date: { lte: missionEnd } }
              ],
              pagination: { limit: 500, page: 0 }
            });

            if (expResult.data) {
              // Robust filtering in memory
              const validExpenses = expResult.data.filter(e => {
                const d = new Date(e.date).getTime();
                return d >= missionStart.getTime() && d <= missionEnd.getTime();
              });
              currentAmount += validExpenses.reduce((sum, e) => sum + Math.abs(e.amount), 0);
            }

            // 3. Sum bank transactions for this category in the time range
            const txResult = await totalumSdk.crud.getRecords<BankTransaction>("bank_transaction", {
              filter: [
                { category: category._id },
                { booking_date: { gte: missionStart } },
                { booking_date: { lte: missionEnd } },
                { transaction_type: "gasto" }
              ],
              pagination: { limit: 500, page: 0 }
            });

            if (txResult.data) {
              // Robust filtering in memory
              const validTx = txResult.data.filter(t => {
                const d = new Date(t.booking_date).getTime();
                return d >= missionStart.getTime() && d <= missionEnd.getTime();
              });
              currentAmount += validTx.reduce((sum, t) => sum + Math.abs(t.amount), 0);
            }

            console.log(`[Gamification API] Calculated mission progress: ${currentAmount}€ for ${mission.category_name}`);
            mission.current_week_amount = currentAmount;
          }
        } catch (calcErr) {
          console.error("[Gamification API] Error calculating mission progress:", calcErr);
        }
      }
    } catch (err) {
      console.log("[Gamification API] No mission data yet", err);
    }

    // 3. Fetch current month budget
    let budget: MonthlyBudget | null = null;
    try {
      const budgetResult = await totalumSdk.crud.getRecords<MonthlyBudget>("monthly_budget", {
        filter: [{ month: currentMonth, year: currentYear }],
        pagination: { limit: 1, page: 0 }
      });
      budget = budgetResult.data?.[0] || null;
      console.log("[Gamification API] Budget data:", budget ? `${budget.total_budget}€` : "not found");
    } catch (err) {
      console.log("[Gamification API] No budget data", err);
    }

    // 4. Fetch this month's expenses (both from expense table and bank transactions)
    let totalExpenses = 0;
    const monthStart = getMonthStart();

    // From expense table
    try {
      const expensesResult = await totalumSdk.crud.getRecords<Expense>("expense", {
        filter: [{ date: { gte: monthStart } }],
        pagination: { limit: 500, page: 0 }
      });
      const expenses = expensesResult.data || [];
      // Filter strictly in memory
      const validExpenses = expenses.filter(e => new Date(e.date).getTime() >= monthStart.getTime());
      totalExpenses += validExpenses.reduce((sum, e) => sum + Math.abs(e.amount), 0);
      console.log("[Gamification API] Manual expenses:", validExpenses.length);
    } catch (err) {
      console.log("[Gamification API] Error fetching expenses", err);
    }

    // From bank transactions (only gastos, processed)
    try {
      const txResult = await totalumSdk.crud.getRecords<BankTransaction>("bank_transaction", {
        filter: [
          { transaction_type: "gasto" },
          { booking_date: { gte: monthStart } }
        ],
        pagination: { limit: 500, page: 0 }
      });
      const transactions = txResult.data || [];
      // Filter strictly in memory
      const validTx = transactions.filter(t => new Date(t.booking_date).getTime() >= monthStart.getTime());
      totalExpenses += validTx.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      console.log("[Gamification API] Bank transactions (gastos):", validTx.length);
    } catch (err) {
      console.log("[Gamification API] Error fetching bank transactions", err);
    }

    // 5. Calculate prediction
    const budgetTotal = budget?.total_budget || 2000; // Default budget if none set
    const budgetRemaining = budgetTotal - totalExpenses;
    const daysPassed = today;
    const dailySpendRate = daysPassed > 0 ? totalExpenses / daysPassed : 0;

    // Predict when budget runs out
    let predictedRunOutDay: number | null = null;
    if (dailySpendRate > 0 && budgetRemaining > 0) {
      const daysUntilRunOut = budgetRemaining / dailySpendRate;
      const runOutDay = today + Math.floor(daysUntilRunOut);
      if (runOutDay <= daysInMonth) {
        predictedRunOutDay = runOutDay;
      }
    } else if (budgetRemaining <= 0) {
      predictedRunOutDay = today; // Already run out
    }

    const projectedMonthEnd = budgetRemaining - (dailySpendRate * daysRemaining);

    const prediction: MonthPrediction = {
      predictedRunOutDay,
      currentSpendRate: Math.round(dailySpendRate * 100) / 100,
      projectedMonthEnd: Math.round(projectedMonthEnd * 100) / 100,
      daysRemaining,
      budgetRemaining: Math.round(budgetRemaining * 100) / 100,
      isOnTrack: projectedMonthEnd >= 0
    };

    // 6. Calculate thermometer
    const usedPercentage = budgetTotal > 0 ? (totalExpenses / budgetTotal) * 100 : 0;
    const expectedPercentage = (today / daysInMonth) * 100;

    let thermometerStatus: "good" | "warning" | "danger" = "good";
    if (usedPercentage > expectedPercentage + 15) {
      thermometerStatus = "danger";
    } else if (usedPercentage > expectedPercentage + 5) {
      thermometerStatus = "warning";
    }

    const gamificationData: GamificationData = {
      streak,
      mission,
      prediction,
      thermometer: {
        percentage: Math.min(Math.round(usedPercentage * 10) / 10, 100),
        budgetTotal,
        budgetUsed: Math.round(totalExpenses * 100) / 100,
        budgetRemaining: Math.round(budgetRemaining * 100) / 100,
        status: thermometerStatus
      }
    };

    console.log("[Gamification API] Data compiled successfully");

    return NextResponse.json({
      ok: true,
      data: gamificationData
    });

  } catch (error) {
    console.error("[Gamification API] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Error al obtener datos de gamificación" },
      { status: 500 }
    );
  }
}

// POST: Update streak or create mission
export async function POST(request: Request) {
  try {
    const body: { action?: string; missionType?: string } = await request.json();
    const { action } = body;

    if (action === "update_streak") {
      console.log("[Gamification API] Updating streak...");

      // Check if there were any expenses today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let hadExpenseToday = false;

      // Check expense table
      try {
        const expensesResult = await totalumSdk.crud.getRecords<Expense>("expense", {
          filter: [
            { date: { gte: today } },
            { date: { lte: tomorrow } }
          ],
          pagination: { limit: 1, page: 0 }
        });
        if ((expensesResult.data?.length || 0) > 0) {
          hadExpenseToday = true;
        }
      } catch (err) {
        console.log("[Gamification API] Error checking today's expenses", err);
      }

      // Check bank transactions
      if (!hadExpenseToday) {
        try {
          const txResult = await totalumSdk.crud.getRecords<BankTransaction>("bank_transaction", {
            filter: [
              { transaction_type: "gasto" },
              { booking_date: { gte: today } },
              { booking_date: { lte: tomorrow } }
            ],
            pagination: { limit: 1, page: 0 }
          });
          if ((txResult.data?.length || 0) > 0) {
            hadExpenseToday = true;
          }
        } catch (err) {
          console.log("[Gamification API] Error checking today's transactions", err);
        }
      }

      // Get or create streak record
      let streak: UserStreak | null = null;
      try {
        const streakResult = await totalumSdk.crud.getRecords<UserStreak>("user_streak", {
          pagination: { limit: 1, page: 0 }
        });
        streak = streakResult.data?.[0] || null;
      } catch (err) {
        console.log("[Gamification API] No existing streak", err);
      }

      if (!streak) {
        // Create new streak record
        const newStreak = {
          current_streak: hadExpenseToday ? 0 : 1,
          best_streak: hadExpenseToday ? 0 : 1,
          last_no_spend_date: hadExpenseToday ? null : today.toISOString(),
          streak_broken_count: 0,
          total_no_spend_days: hadExpenseToday ? 0 : 1
        };
        await totalumSdk.crud.createRecord("user_streak", newStreak);
        console.log("[Gamification API] Created new streak record");
      } else {
        // Update existing streak
        const lastNoSpend = streak.last_no_spend_date ? new Date(streak.last_no_spend_date) : null;
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let updates: Partial<UserStreak>;

        if (hadExpenseToday) {
          // Streak broken
          updates = {
            current_streak: 0,
            streak_broken_count: streak.streak_broken_count + 1
          };
          console.log("[Gamification API] Streak broken - expense today");
        } else {
          // No expense today
          const isConsecutive = lastNoSpend &&
            lastNoSpend.toDateString() === yesterday.toDateString();

          const newCurrentStreak = isConsecutive ? streak.current_streak + 1 : 1;
          const newBestStreak = Math.max(streak.best_streak, newCurrentStreak);

          updates = {
            current_streak: newCurrentStreak,
            best_streak: newBestStreak,
            last_no_spend_date: today.toISOString(),
            total_no_spend_days: streak.total_no_spend_days + 1
          };
          console.log("[Gamification API] Streak updated:", newCurrentStreak);
        }

        await totalumSdk.crud.editRecordById("user_streak", streak._id, updates);
      }

      return NextResponse.json({ ok: true, data: { message: "Racha actualizada" } });

    } else if (action === "generate_mission") {
      console.log("[Gamification API] Generating new weekly mission...");

      const weekStart = getWeekStart();
      const weekEnd = getWeekEnd();

      // Time ranges for baseline calculation
      // 1. Last Week
      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(weekStart);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

      // 2. Last 30 Days (for average fallback)
      const last30DaysStart = new Date();
      last30DaysStart.setDate(last30DaysStart.getDate() - 30);

      // Randomly select mission type
      const missionTypes = [
        { type: "reduce_food", category: "Supermercado" },
        { type: "reduce_transport", category: "Transporte" },
        { type: "reduce_entertainment", category: "Ocio y Entretenimiento" }
      ];
      const selectedMission = missionTypes[Math.floor(Math.random() * missionTypes.length)];

      let baselineAmount = 0;
      let baselineSource = "last_week";

      // Fetch category ID first
      let categoryId: string | null = null;
      try {
        const catResult = await totalumSdk.crud.getRecords<Category>("category", {
          filter: [{ name: selectedMission.category }],
          pagination: { limit: 1, page: 0 }
        });
        if (catResult.data?.[0]) {
          categoryId = catResult.data[0]._id;
        }
      } catch (err) {
        console.log("[Gamification API] Error fetching category for mission", err);
      }

      if (categoryId) {
        // Helper to calculate total for a period and category
        const calculateTotal = async (start: Date, end: Date) => {
          let total = 0;

          // Manual expenses
          try {
            const expResult = await totalumSdk.crud.getRecords<Expense>("expense", {
              filter: [
                { category: categoryId },
                { date: { gte: start } },
                { date: { lte: end } }
              ],
              pagination: { limit: 500, page: 0 }
            });
            if (expResult.data) {
              const valid = expResult.data.filter(e => {
                const d = new Date(e.date).getTime();
                return d >= start.getTime() && d <= end.getTime();
              });
              total += valid.reduce((sum, e) => sum + Math.abs(e.amount), 0);
            }
          } catch (e) { console.error("Error calc manual exp", e); }

          // Bank transactions
          try {
            const txResult = await totalumSdk.crud.getRecords<BankTransaction>("bank_transaction", {
              filter: [
                { category: categoryId },
                { transaction_type: "gasto" },
                { booking_date: { gte: start } },
                { booking_date: { lte: end } }
              ],
              pagination: { limit: 500, page: 0 }
            });
            if (txResult.data) {
              const valid = txResult.data.filter(t => {
                const d = new Date(t.booking_date).getTime();
                return d >= start.getTime() && d <= end.getTime();
              });
              total += valid.reduce((sum, t) => sum + Math.abs(t.amount), 0);
            }
          } catch (e) { console.error("Error calc bank tx", e); }

          return total;
        };

        // 1. Try Last Week
        const lastWeekTotal = await calculateTotal(lastWeekStart, lastWeekEnd);
        console.log(`[Gamification API] Last week total for ${selectedMission.category}: ${lastWeekTotal}`);

        if (lastWeekTotal > 10) {
          baselineAmount = lastWeekTotal;
          baselineSource = "last_week";
        } else {
          // 2. Fallback: Monthly Average (Total last 30 days / 4)
          console.log("[Gamification API] Last week too low, trying 30-day average...");
          const monthTotal = await calculateTotal(last30DaysStart, new Date()); // until now
          const weeklyAverage = monthTotal / 4.3; // 4.3 weeks in a month approx
          console.log(`[Gamification API] 30-day total: ${monthTotal}, Weekly Avg: ${weeklyAverage}`);

          if (weeklyAverage > 10) {
            baselineAmount = weeklyAverage;
            baselineSource = "monthly_average";
          } else {
            // Fallback default if barely any data exists
            baselineAmount = 50;
            baselineSource = "default_min";
          }
        }
      } else {
        console.log("[Gamification API] Category not found, using default");
        baselineAmount = 100;
      }

      // Create mission with 10% reduction target
      const newMission = {
        mission_type: selectedMission.type,
        target_percentage: 10,
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString(),
        status: "active",
        previous_week_amount: Math.round(baselineAmount * 100) / 100, // Round to 2 decimals
        current_week_amount: 0,
        category_name: selectedMission.category,
        baseline_source: baselineSource // Optional: store this if we want to show it in UI later
      };

      // Mark any existing active missions as failed
      try {
        const existingMissions = await totalumSdk.crud.getRecords<WeeklyMission>("weekly_mission", {
          filter: [{ status: "active" }],
          pagination: { limit: 10, page: 0 }
        });
        for (const m of existingMissions.data || []) {
          await totalumSdk.crud.editRecordById("weekly_mission", m._id, { status: "failed" });
        }
      } catch (err) {
        console.log("[Gamification API] Error updating old missions", err);
      }

      await totalumSdk.crud.createRecord("weekly_mission", newMission);
      console.log("[Gamification API] Created new mission:", selectedMission.type, "Baseline:", baselineAmount);

      return NextResponse.json({ ok: true, data: { message: "Misión generada", mission: newMission } });
    }

    return NextResponse.json(
      { ok: false, error: "Acción no válida" },
      { status: 400 }
    );

  } catch (error) {
    console.error("[Gamification API] POST Error:", error);
    return NextResponse.json(
      { ok: false, error: "Error al procesar la acción" },
      { status: 500 }
    );
  }
}
