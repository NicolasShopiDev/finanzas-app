
import { totalumSdk } from "@/lib/totalum";
import { KlarnaConfig } from "@/types/database";

const KLARNA_API_URL_PLAYGROUND = "https://api.openbanking.playground.klarna.com";
const KLARNA_API_URL_PRODUCTION = "https://api.openbanking.klarna.com";

export class KlarnaService {

    private async getConfig(): Promise<KlarnaConfig | null> {
        try {
            const result = await totalumSdk.crud.getRecords<KlarnaConfig>("klarna_config", {
                pagination: { limit: 1, page: 0 }
            });
            return result.data?.[0] || null;
        } catch (e) {
            console.error("Error fetching Klarna config", e);
            return null;
        }
    }

    private getBaseUrl(): string {
        // In a real app we might check valid environment or config "is_production" flag.
        // Defaulting to Playground as requested by user "probarlo con el modo sandbox".
        return KLARNA_API_URL_PLAYGROUND;
    }

    async getAccessToken(): Promise<string | null> {
        const config = await this.getConfig();
        if (!config || !config.api_token) return null;
        return config.api_token;
    }

    async getHeaders(): Promise<HeadersInit | null> {
        const token = await this.getAccessToken();
        if (!token) return null;
        return {
            "Authorization": `Token ${token}`,
            "Content-Type": "application/json"
        };
    }

    // Placeholder for institution fetching
    async getInstitutions() {
        // Implement logic
        return [];
    }
}

export const klarnaService = new KlarnaService();
