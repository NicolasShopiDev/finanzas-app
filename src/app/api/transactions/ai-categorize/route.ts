// API route for AI-powered transaction categorization
import { NextRequest, NextResponse } from "next/server";
import { totalumSdk } from "@/lib/totalum";
import { BankTransaction, Category } from "@/types/database";

// Interface for AI prediction result
interface CategoryPrediction {
  transactionId: string;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  confidence: "alta" | "media" | "baja";
  reasoning: string;
}

interface AICategorizationResponse {
  predictions: CategoryPrediction[];
}

// POST: Get AI predictions for pending transactions
export async function POST(request: NextRequest) {
  try {
    const body: { transactionIds?: string[] } = await request.json();
    const transactionIds: string[] = body.transactionIds || [];

    if (transactionIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Se requiere al menos una transacción" },
        { status: 400 }
      );
    }

    console.log(`[AI Categorize] Processing ${transactionIds.length} transactions`);

    // 1. Fetch the pending transactions
    const pendingTransactions: BankTransaction[] = [];
    for (const id of transactionIds) {
      try {
        const result = await totalumSdk.crud.getRecordById<BankTransaction>("bank_transaction", id);
        if (result.data) {
          pendingTransactions.push(result.data);
        }
      } catch (err) {
        console.error(`[AI Categorize] Error fetching transaction ${id}:`, err);
      }
    }

    if (pendingTransactions.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No se encontraron transacciones válidas" },
        { status: 404 }
      );
    }

    // 2. Fetch all available categories
    const categoriesResult = await totalumSdk.crud.getRecords<Category>("category", {
      sort: { name: 1 },
      pagination: { limit: 100, page: 0 }
    });
    const categories = categoriesResult.data || [];

    if (categories.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No hay categorías disponibles" },
        { status: 400 }
      );
    }

    console.log(`[AI Categorize] Found ${categories.length} categories`);

    // 3. Fetch historical transactions (already categorized) for pattern learning
    const historicalResult = await totalumSdk.crud.getRecords<BankTransaction>("bank_transaction", {
      filter: [
        { is_processed: "si" }
      ],
      sort: { booking_date: -1 },
      pagination: { limit: 200, page: 0 }
    });

    // Filter to only include those with a category assigned
    const historicalTransactions = (historicalResult.data || []).filter(tx => tx.category);

    console.log(`[AI Categorize] Found ${historicalTransactions.length} historical transactions for learning`);

    // 4. Build the prompt for AI
    const categoriesList = categories.map(c => `- ${c._id}: ${c.icon} ${c.name} (${c.type})`).join("\n");

    // Build historical examples (if any)
    let historicalExamples = "";
    if (historicalTransactions.length > 0) {
      const examples = historicalTransactions.slice(0, 50).map(tx => {
        const catId = typeof tx.category === "string" ? tx.category : tx.category?._id;
        const cat = categories.find(c => c._id === catId);
        return `- "${tx.merchant_name || tx.description}" (${tx.amount}€) → ${cat ? `${cat.icon} ${cat.name}` : "Sin categoría"}`;
      }).join("\n");
      historicalExamples = `\n\nEjemplos de transacciones ya clasificadas por el usuario:\n${examples}`;
    }

    // Build the transactions to classify
    const transactionsToClassify = pendingTransactions.map(tx =>
      `- ID: ${tx._id} | Comerciante: "${tx.merchant_name || "N/A"}" | Descripción: "${tx.description || "N/A"}" | Cantidad: ${tx.amount}€ | Tipo: ${tx.transaction_type}`
    ).join("\n");

    const systemPrompt = `Eres un asistente experto en finanzas personales. Tu tarea es clasificar transacciones bancarias en las categorías disponibles basándote en el nombre del comerciante, la descripción y el tipo de transacción.

Categorías disponibles:
${categoriesList}
${historicalExamples}

REGLAS IMPORTANTES:
1. Analiza el nombre del comerciante y la descripción para determinar la categoría más adecuada
2. Si la cantidad es positiva (ingreso), generalmente no aplica a categorías de gastos
3. Busca patrones en los ejemplos históricos para aprender las preferencias del usuario
4. Si no estás seguro, indica confianza "baja"
5. Responde SOLO con JSON válido, sin texto adicional

Responde en formato JSON con la siguiente estructura:
{
  "predictions": [
    {
      "transactionId": "ID de la transacción",
      "suggestedCategoryId": "ID de la categoría sugerida o null si no hay sugerencia",
      "suggestedCategoryName": "Nombre de la categoría o null",
      "confidence": "alta" | "media" | "baja",
      "reasoning": "Breve explicación de por qué se sugiere esta categoría"
    }
  ]
}`;

    const userPrompt = `Clasifica las siguientes transacciones bancarias pendientes:

${transactionsToClassify}

Responde SOLO con el JSON, sin explicaciones adicionales.`;

    console.log("[AI Categorize] Calling OpenAI API...");

    // 5. Call OpenAI via Totalum SDK
    const chatBody = {
      messages: [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt }
      ],
      model: "gpt-4.1-mini",
      max_tokens: 2000,
      temperature: 0.3 // Lower temperature for more consistent categorization
    };

    const aiResult = await totalumSdk.openai.createChatCompletion(chatBody);
    const aiResponse = aiResult.data?.choices?.[0]?.message?.content;

    if (!aiResponse) {
      console.error("[AI Categorize] No response from AI");
      return NextResponse.json(
        { ok: false, error: "No se recibió respuesta de la IA" },
        { status: 500 }
      );
    }

    console.log("[AI Categorize] AI Response received");

    // 6. Parse AI response
    let parsedResponse: AICategorizationResponse;
    try {
      // Clean the response (remove markdown code blocks if present)
      let cleanedResponse = aiResponse.trim();
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.slice(7);
      }
      if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith("```")) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      cleanedResponse = cleanedResponse.trim();

      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("[AI Categorize] Error parsing AI response:", parseError);
      console.error("[AI Categorize] Raw response:", aiResponse);
      return NextResponse.json(
        { ok: false, error: "Error al procesar la respuesta de la IA" },
        { status: 500 }
      );
    }

    // 7. Validate predictions against actual category IDs
    const validatedPredictions = parsedResponse.predictions.map(pred => {
      const category = categories.find(c => c._id === pred.suggestedCategoryId);
      if (!category && pred.suggestedCategoryId) {
        // Try to find by name
        const categoryByName = categories.find(c =>
          c.name.toLowerCase() === pred.suggestedCategoryName?.toLowerCase()
        );
        if (categoryByName) {
          return {
            ...pred,
            suggestedCategoryId: categoryByName._id,
            suggestedCategoryName: `${categoryByName.icon} ${categoryByName.name}`
          };
        }
        // Invalid category, return null suggestion
        return {
          ...pred,
          suggestedCategoryId: null,
          suggestedCategoryName: null,
          confidence: "baja" as const,
          reasoning: "No se pudo determinar una categoría con certeza"
        };
      }

      return {
        ...pred,
        suggestedCategoryName: category ? `${category.icon} ${category.name}` : null
      };
    });

    console.log(`[AI Categorize] Returning ${validatedPredictions.length} predictions`);

    return NextResponse.json({
      ok: true,
      data: {
        predictions: validatedPredictions,
        totalProcessed: validatedPredictions.length
      }
    });

  } catch (error) {
    console.error("[AI Categorize] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Error al procesar la categorización con IA" },
      { status: 500 }
    );
  }
}
