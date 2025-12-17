
const { TotalumApiSdk } = require('totalum-api-sdk');
const fs = require('fs');
const path = require('path');

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
            console.log("✅ Loaded .env");
        } else {
            console.log("⚠️ .env not found");
        }
    } catch (e) {
        console.error("Failed to parse .env", e);
    }
}
loadEnv();

async function main() {
    const apiKey = process.env.TOTALUM_API_KEY;
    const baseUrl = process.env.TOTALUM_API_URL || 'https://api.totalum.app/';

    if (!apiKey) {
        console.error("❌ TOTALUM_API_KEY not found in env.");
        process.exit(1);
    }

    console.log(`🔌 Connecting to ${baseUrl} with key ${apiKey.substring(0, 5)}...`);

    // Check if SDK constructor works with require
    // If TotalumApiSdk is default export, we might need .default
    const SdkClass = TotalumApiSdk.default || TotalumApiSdk;

    const totalumSdk = new SdkClass({ apiKey: { 'api-key': apiKey } });
    totalumSdk.changeBaseUrl(baseUrl);

    try {
        // Fetch Categories
        // The SDK method getRecords likely returns { data: [], ... }
        console.log("Fetching categories...");
        const cats = await totalumSdk.crud.getRecords("category", {
            pagination: { limit: 5, page: 0 }
            // Removing strict filter to see everything
        });

        if (cats.data && Array.isArray(cats.data)) {
            console.log(`\nFound ${cats.data.length} categories:`);
            cats.data.forEach(c => {
                console.log(`- [${c.type}] ${c.name} (ID: ${c._id}) User: ${c.userId}`);
            });
        } else {
            console.log("No categories found or invalid format:", cats);
        }

        // Fetch Expenses
        console.log("\nFetching recent expenses...");
        const expenses = await totalumSdk.crud.getRecords("expense", {
            pagination: { limit: 5, page: 0 }
        });

        if (expenses.data && Array.isArray(expenses.data)) {
            console.log(`\nFound ${expenses.data.length} recent expenses:`);
            expenses.data.forEach(e => {
                console.log(`- ${e.date ? e.date.substring(0, 10) : 'NoDate'} | ${e.amount}€ | ${e.description} (${e.categoryNameSnapshot})`);
            });
        } else {
            console.log("No expenses found.");
        }

    } catch (e) {
        console.error("SDK Error:", e);
    }
}

main();
