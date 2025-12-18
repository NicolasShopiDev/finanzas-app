import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Get the authenticated user from the request.
 * Returns null if user is not authenticated.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };
  } catch (error) {
    console.error("[Auth] Error getting session:", error);
    return null;
  }
}

/**
 * Require authentication - throws error if user is not authenticated.
 * Use this in API routes that require authentication.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();

  if (!user) {
    throw new AuthError("Unauthorized - Please login", 401);
  }

  return user;
}

/**
 * Custom error class for authentication errors
 */
export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

/**
 * Helper to create unauthorized response
 */
export function unauthorizedResponse() {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "Unauthorized - Please login",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
