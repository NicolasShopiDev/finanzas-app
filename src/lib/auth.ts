import "server-only";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { totalumAdapter } from "@/lib/better-auth-totalum-adapter";
import { totalumSdk } from "@/lib/totalum";

export const auth = betterAuth({
  // Database adapter
  database: totalumAdapter(totalumSdk, {
    debugLogs: true,
  }),

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 6,
    maxPasswordLength: 128,
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session once per day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },

  // Security
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  basePath: "/api/auth",

  // Trusted origins for CORS
  // 🚨 IMPORTANT: Add the parent website domain that will host the iframe
  trustedOrigins: [
      "*",
    ], 

  // Advanced security options
  advanced: {
    cookiePrefix: "better-auth",
    defaultCookieAttributes: {
      httpOnly: true,
      secure: true,
      sameSite: "none",        // <-- required for cross-site iframe
      path: "/",
    },
    crossSubDomainCookies: {
      enabled: false,
    },
    cookies: {
      session_token: {
        attributes: { sameSite: "none", secure: true, httpOnly: true, path: "/" },
      },
      session_data: {
        attributes: { sameSite: "none", secure: true, httpOnly: true, path: "/" },
      },
    },
    useSecureCookies: true,
  },

  // Plugins - Bearer token support for API clients
  plugins: [
    bearer(),  
  ],

  // User model customization
  user: {
    additionalFields: {
      // You can add custom fields here if needed
      // example: {
      //   type: "string",
      //   required: false,
      // }
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
