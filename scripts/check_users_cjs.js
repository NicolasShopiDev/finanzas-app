
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
    const apiKey = process.env.TOTALUM_API_KEY;
    const baseUrl = process.env.TOTALUM_API_URL || 'https://api.totalum.app/';

    if (!apiKey) {
        console.error("❌ TOTALUM_API_KEY not found in env.");
        process.exit(1);
    }

    // Handle ESM/CJS interop for SDK
    const SdkClass = TotalumApiSdk.default || TotalumApiSdk;
    const totalumSdk = new SdkClass({ apiKey: { 'api-key': apiKey } });
    totalumSdk.changeBaseUrl(baseUrl);

    console.log("🔍 Checking for users via SDK (CJS)...");

    try {
        const users = await totalumSdk.crud.getRecords("user", {
            pagination: { limit: 10, page: 0 }
        });

        if (users.data && users.data.length > 0) {
            console.log(`✅ Found ${users.data.length} users.`);
            users.data.forEach(u => {
                console.log(`USER_FOUND: ${u._id}`);
                console.log(`DETAILS: ${u.name} (${u.email})`);
            });
        } else {
            console.log("❌ No users found in 'user' collection.");
        }
    } catch (e) {
        console.error("Error fetching users:", e);
    }
}

main();
