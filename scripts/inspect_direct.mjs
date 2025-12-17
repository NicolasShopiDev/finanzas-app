
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

if (!API_KEY) {
    console.error("❌ No API KEY");
    process.exit(1);
}

const HEADERS = {
    'api-key': API_KEY,
    'Content-Type': 'application/json'
};

async function main() {
    console.log(`🔌 Inspecting Data at [${API_URL}]...`);

    // 1. Fetch Categories
    try {
        console.log("\n📦 --- CATEGORIES ---");
        // Usually filtering is done via query params in this API pattern or just getting all
        // The SDK uses a POST to /search or GET /resource?
        // Let's try GET /category based on seed_direct usage
        const res = await fetch(`${API_URL}/category?limit=50`, { headers: HEADERS });
        if (res.ok) {
            const json = await res.json();
            const data = json.data || [];
            if (data.length > 0) {
                console.table(data.map(c => ({
                    ID: c._id,
                    Name: c.name,
                    Status: c.status,
                    User: c.userId
                })));
            } else {
                console.log("No categories found.");
            }
        } else {
            console.error("Failed to fetch categories:", res.status, await res.text());
        }
    } catch (e) {
        console.error("Error fetching categories:", e);
    }

    // 2. Fetch Expenses
    try {
        console.log("\n💸 --- EXPENSES (Last 20) ---");
        const res = await fetch(`${API_URL}/expense?limit=20&sort=-date`, { headers: HEADERS });
        if (res.ok) {
            const json = await res.json();
            const data = json.data || [];
            if (data.length > 0) {
                console.table(data.map(e => ({
                    Desc: e.description,
                    Amount: e.amount,
                    Date: e.date,
                    Category: e.categoryNameSnapshot || "N/A"
                })));
            } else {
                console.log("No expenses found.");
            }
        } else {
            console.error("Failed to fetch expenses:", res.status, await res.text());
        }
    } catch (e) {
        console.error("Error fetching expenses:", e);
    }
}

main();
