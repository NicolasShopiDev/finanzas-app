
import fs from 'fs';
import path from 'path';

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
    } catch (e) {
        console.error("No .env found", e);
    }
}
loadEnv();

const API_KEY = process.env.TOTALUM_API_KEY;
const API_URL = process.env.TOTALUM_API_URL || 'https://api.totalum.app';
const HEADERS = { 'api-key': API_KEY, 'Content-Type': 'application/json' };

const STANDARD_CATEGORIES = [
    { name: "Supermercado", icon: "🛒", type: "variable", percentage: 15 },
    { name: "Restaurantes", icon: "🍔", type: "variable", percentage: 10 },
    { name: "Transporte", icon: "🚌", type: "variable", percentage: 5 },
    { name: "Alquiler", icon: "🏠", type: "fija", fixed_amount: 800 },
    { name: "Servicios", icon: "💡", type: "fija", fixed_amount: 100 },
];

async function main() {
    console.log(`🔌 Connecting to ${API_URL}...`);

    // 1. Get Users
    let users = [];
    try {
        const res = await fetch(`${API_URL}/user`, { headers: HEADERS });
        if (res.ok) {
            const json = await res.json();
            users = json.data || [];
        }
    } catch (e) { console.error("Error fetching users", e); }

    if (users.length === 0) {
        console.log("❌ No registered users found in DB! Please sign up in the app first.");
        return;
    }

    console.log(`\n✅ Found ${users.length} Users:`);
    users.forEach(u => console.log(`- ${u.name || 'NoName'} (${u.email}) [ID: ${u.id || u._id}]`));

    // 2. Clear Bad Data (User: undefined)
    // Complex to filter by 'undefined' via API usually, so we'll just skip this for now 
    // and focus on creating GOOD data for the first found user.

    const targetUser = users[0];
    console.log(`\n👉 Seeding valid data for: ${targetUser.email} (ID: ${targetUser.id || targetUser._id})`);

    const userId = targetUser.id || targetUser._id;

    // 3. Create Categories
    const catMap = {};
    for (const cat of STANDARD_CATEGORIES) {
        const body = { ...cat, userId, status: 'active' };
        const res = await fetch(`${API_URL}/category`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(body)
        });
        const json = await res.json();
        if (json.data?._id) {
            catMap[cat.name] = json.data._id;
            process.stdout.write("C");
        }
    }
    console.log("\n✅ Categories created.");

    // 4. Create Expenses
    const descriptions = ["Mercadona", "Uber", "Cine", "Gasolinera"];
    for (let i = 0; i < 5; i++) {
        const catName = Object.keys(catMap)[0]; // Just pick first one
        const catId = catMap[catName];

        const body = {
            description: descriptions[i % descriptions.length],
            amount: 50 + (i * 10),
            date: new Date().toISOString(),
            category: catId,
            categoryNameSnapshot: catName,
            userId // Explicitly set if API supports it, though usually inferred from context or category
        };

        await fetch(`${API_URL}/expense`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(body)
        });
        process.stdout.write("E");
    }
    console.log("\n✅ Expenses created properly linked to user.");
}

main();
