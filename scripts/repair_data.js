
const { TotalumApiSdk } = require('totalum-api-sdk');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
                }
            });
        }
    } catch (e) { console.error(e); }
}
loadEnv();

const STANDARD_CATEGORIES = [
    { name: "Supermercado", icon: "🛒", type: "variable", percentage: 15 },
    { name: "Restaurantes", icon: "🍔", type: "variable", percentage: 10 },
    { name: "Transporte", icon: "🚌", type: "variable", percentage: 5 },
    { name: "Alquiler", icon: "🏠", type: "fija", fixed_amount: 800 },
    { name: "Servicios", icon: "💡", type: "fija", fixed_amount: 100 },
];

async function main() {
    const apiKey = process.env.TOTALUM_API_KEY;
    const baseUrl = process.env.TOTALUM_API_URL || 'https://api.totalum.app/';

    if (!apiKey) {
        console.error("❌ NO API KEY");
        process.exit(1);
    }

    const SdkClass = TotalumApiSdk.default || TotalumApiSdk;
    const totalumSdk = new SdkClass({ apiKey: { 'api-key': apiKey } });
    totalumSdk.changeBaseUrl(baseUrl);

    console.log("🛠️ STARTING REPAIR SCRIPT...");

    // 1. Find User
    const users = await totalumSdk.crud.getRecords("user", { pagination: { limit: 1, page: 0 } });
    if (!users.data || users.data.length === 0) {
        console.error("❌ No user found. Cannot seed.");
        process.exit(1);
    }

    const user = users.data[0];
    const userId = user._id || user.id;
    console.log(`✅ Target User: ${user.name} (${userId})`);

    // 2. Clean Categories (optional, or just add new ones)
    // We will just add new ones to be safe

    // 3. Seed Categories
    console.log("🌱 Seeding Categories for NicoCEO...");
    const catMap = {};
    for (const cat of STANDARD_CATEGORIES) {
        const payload = { ...cat, userId, status: 'active' };
        // Check if exists first to avoid duplicates? Optional.
        // Simplified: Just create.
        const res = await totalumSdk.crud.createRecord("category", payload);
        if (res.data) {
            catMap[cat.name] = res.data._id;
            process.stdout.write("C");
        }
    }
    console.log("\n✅ Categories Created");

    // 4. Seed Expenses
    console.log("🌱 Seeding Expenses...");
    const descriptions = ["Mercadona", "Uber", "Cine", "Gasolinera", "Cena", "Amazon", "Gym"];
    const today = new Date();

    for (let i = 0; i < 10; i++) {
        const randomCatName = Object.keys(catMap)[Math.floor(Math.random() * Object.keys(catMap).length)];
        const catId = catMap[randomCatName];

        if (catId) {
            // Random date in current month
            const day = Math.floor(Math.random() * 20) + 1;
            const date = new Date(today.getFullYear(), today.getMonth(), day);

            const expense = {
                description: descriptions[Math.floor(Math.random() * descriptions.length)],
                amount: Math.floor(Math.random() * 100) + 10,
                date: date.toISOString(),
                category: catId,
                categoryNameSnapshot: randomCatName,
                userId: userId // CRITICAL FIX
            };

            await totalumSdk.crud.createRecord("expense", expense);
            process.stdout.write("E");
        }
    }
    console.log("\n✅ Expenses Created & Linked!");
    console.log("✨ REPAIR COMPLETE. Check your dashboard.");
}

main();
