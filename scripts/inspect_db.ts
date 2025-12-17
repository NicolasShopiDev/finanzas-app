
import { TotalumApiSdk } from 'totalum-api-sdk';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env parser
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, '');
                    process.env[key] = value;
                }
            });
        }
    } catch (e) {
        console.error("Failed to parse .env", e);
    }
}
loadEnv();

async function main() {
    console.log("🔍 Inspecting Database Content...");

    const apiKey = process.env.TOTALUM_API_KEY;
    const baseUrl = process.env.TOTALUM_API_URL || 'https://api.totalum.app/';

    if (!apiKey) {
        console.error("❌ TOTALUM_API_KEY not found in env.");
        process.exit(1);
    }

    const totalumSdk = new TotalumApiSdk({ apiKey: { 'api-key': apiKey } });
    totalumSdk.changeBaseUrl(baseUrl);

    try {
        // 1. Fetch Categories
        console.log("\n📂 --- CATEGORIES ---");
        const cats = await totalumSdk.crud.getRecords("category", {
            pagination: { limit: 50, page: 0 },
            filter: [{ status: 'active' }]
        });

        if (cats.data && cats.data.length > 0) {
            console.table(cats.data.map((c: any) => ({
                ID: c._id,
                Name: c.name,
                Type: c.type,
                UserID: c.userId,
                Budget: c.type === 'fija' ? c.fixed_amount : c.percentage + '%'
            })));
            console.log(`Total Active Categories: ${cats.data.length}`);
        } else {
            console.log("No active categories found.");
        }

        // 2. Fetch Expenses
        console.log("\n💸 --- LAST 20 EXPENSES ---");
        // Often expenses are better sorted by date desc
        const expenses = await totalumSdk.crud.getRecords("expense", {
            pagination: { limit: 20, page: 0 }
        });

        if (expenses.data && expenses.data.length > 0) {
            console.table(expenses.data.map((e: any) => ({
                Desc: e.description,
                Amount: e.amount,
                Date: e.date.split('T')[0],
                Category: e.categoryNameSnapshot || e.category,
                UserID: e.userId // sometimes userId is on expense, sometimes inferred
            })));
            console.log(`Showing ${expenses.data.length} recent expenses.`);
        } else {
            console.log("No expenses found.");
        }

    } catch (e) {
        console.error("Error fetching data:", e);
    }
}

main();
