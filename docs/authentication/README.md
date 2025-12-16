---
name: authentication
description: "User authentication with Better Auth and Totalum. Use when implementing login, registration, user sessions, or protected routes. Activates for auth setup, database tables for auth, session management, and auth UI components. ONLY use when user explicitly requests authentication."
---

# Authentication Skill

Use this skill ONLY when the user explicitly requests authentication features.

## When to Use This Skill

- when user requests to add/edit authentication features

**DO NOT use for:**
- Projects without auth requirements

---

## Authentication Setup Workflow

### Step 1: Check Existing Tables
```typescript
mcp__totalum__getAllDatabaseTables()
```
Check if `user`, `session`, `account`, `verification` tables exist.

### Step 2: Create Auth Tables (If Not Exist)

**Execute these MCP calls in order (not parallel):**

#### Table 1: user
```typescript
mcp__totalum__createDatabaseTable({
  type: "user",
  label: "User",
  description: "Table used for Auth. Stores users",
  icon: "fa-solid fa-user",
  mustTheTableBeVisibleOnBackOffice: true,
  properties: [
    { name: "email", label: "Email", propertyType: "string", typeExtras: { string: { type: "text" } } },
    { name: "name", label: "Name", propertyType: "string", typeExtras: { string: { type: "text" } } },
    { name: "email_verified", label: "Email Verified", propertyType: "number" },
    { name: "image", label: "Image", propertyType: "string", typeExtras: { string: { type: "link" } } }
  ]
})
```

#### Table 2: session
```typescript
mcp__totalum__createDatabaseTable({
  type: "session",
  label: "Session",
  description: "Table used for Auth. Stores user auth sessions",
  icon: "fa-solid fa-clock",
  mustTheTableBeVisibleOnBackOffice: false,
  properties: [
    { name: "user_id", label: "User ID", propertyType: "string" },
    { name: "token", label: "Token", propertyType: "string" },
    { name: "expires_at", label: "Expires At", propertyType: "date", typeExtras: { date: { includeHour: true } } },
    { name: "ip_address", label: "IP Address", propertyType: "string" },
    { name: "user_agent", label: "User Agent", propertyType: "string" }
  ]
})
```

#### Table 3: account
```typescript
mcp__totalum__createDatabaseTable({
  type: "account",
  label: "Account",
  description: "Table used for Auth. Stores accounts tokens",
  icon: "fa-solid fa-id-card",
  mustTheTableBeVisibleOnBackOffice: false,
  properties: [
    { name: "user_id", label: "User ID", propertyType: "string" },
    { name: "account_id", label: "Account ID", propertyType: "string" },
    { name: "provider_id", label: "Provider ID", propertyType: "string" },
    { name: "password", label: "Password", propertyType: "string" },
    { name: "access_token", label: "Access Token", propertyType: "long-string", typeExtras: { "long-string": { type: "text" } } },
    { name: "refresh_token", label: "Refresh Token", propertyType: "long-string", typeExtras: { "long-string": { type: "text" } } },
    { name: "id_token", label: "ID Token", propertyType: "long-string", typeExtras: { "long-string": { type: "text" } } },
    { name: "access_token_expires_at", label: "Access Token Expires At", propertyType: "date", typeExtras: { date: { includeHour: true } } },
    { name: "refresh_token_expires_at", label: "Refresh Token Expires At", propertyType: "date", typeExtras: { date: { includeHour: true } } },
    { name: "scope", label: "Scope", propertyType: "string" }
  ]
})
```

#### Table 4: verification
```typescript
mcp__totalum__createDatabaseTable({
  type: "verification",
  label: "Verification",
  description: "Table used for Auth. Stores verification tokens",
  icon: "fa-solid fa-check-circle",
  mustTheTableBeVisibleOnBackOffice: false,
  properties: [
    { name: "identifier", label: "Identifier", propertyType: "string", typeExtras: { string: { type: "text" } } },
    { name: "value", label: "Value", propertyType: "string" },
    { name: "expires_at", label: "Expires At", propertyType: "date", typeExtras: { date: { includeHour: true } } }
  ]
})
```

### Step 3: Link User to Other Tables
If other tables need user association, add objectReference:
```typescript
mcp__totalum__createTableProperty({
  structureId: "other_table_id",
  property: {
    name: "user",
    label: "User",
    propertyType: "objectReference",
    objectReference: {
      objectReferenceTypeId: "user",
      objectReferenceRelation: "manyToOne"
    }
  }
})
```

---

## Existing Auth Files (Pre-configured)

**DO NOT modify unless explicitly requested:**
- `src/lib/auth.ts` - Server-side auth config
- `src/lib/auth-client.ts` - Client-side hooks
- `src/lib/better-auth-totalum-adapter.ts` - Totalum adapter
- `src/app/api/auth/[...all]/route.ts` - API handler
- `src/middleware.ts` - Route protection

---

## Using Authentication

### Server Components
```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function ProtectedPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return <div>Welcome, {session.user.name}!</div>;
}
```

### Client Components
```typescript
"use client";
import { useSession, signIn, signUp, signOut } from "@/lib/auth-client";

export function AuthComponent() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;

  if (!session) {
    return (
      <div>
        <Button onClick={() => signIn.email({ email, password })}>
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p>Welcome, {session.user.name}</p>
      <Button onClick={() => signOut()}>Sign Out</Button>
    </div>
  );
}
```

### Sign Up Flow
```typescript
const handleSignUp = async (formData: { email: string; password: string; name: string }) => {
  await signUp.email({
    email: formData.email,
    password: formData.password,
    name: formData.name
  });
};
```

### Sign In Flow
```typescript
const handleSignIn = async (formData: { email: string; password: string }) => {
  await signIn.email({
    email: formData.email,
    password: formData.password
  });
};
```

---

## Protected Routes

### Middleware Configuration
`src/middleware.ts` protects routes:
```typescript
const publicRoutes = [
  "/",
  "/login",
  "/register",
  "/privacy-policy",
  "/terms-of-service",
  // SUPER IMPORTANT: add new public routes here when needed
];
```

**Any route NOT in publicRoutes requires authentication!**

---

## Header with Auth Links

**Only add auth links when auth is implemented:**

```typescript
"use client";
import { useSession, signOut } from "@/lib/auth-client";
import Link from "next/link";

export function Header() {
  const { data: session, isPending } = useSession();

  return (
    <header>
      {/* ... other header content ... */}

      <nav className="flex items-center gap-4">
        {isPending ? null : session ? (
          <>
            <span>{session.user.name}</span>
            <Button variant="ghost" onClick={() => signOut()}>
              Sign Out
            </Button>
          </>
        ) : (
          <>
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>Sign Up</Button>
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
```

---

## Critical Rules

Implement the auth system in a way that when the user registers on frontend is automatically logged in, for avoid asking to login again right after registration.

### Database Rules
- [ ] Never add `_id`, `createdAt`, `updatedAt` (auto-created)
- [ ] Always add `includeHour: true` for date fields
- [ ] Use `long-string` for tokens
- [ ] Only `user` table visible in back-office

### Auth Rules
- [ ] User actually requested auth before implementing
- [ ] All 4 tables created in correct order
- [ ] objectReference used to link user to other tables
- [ ] New public routes added to middleware

### Adapter Notes
- Totalum adapter handles camelCase ↔ snake_case automatically
- Boolean fields use options (yes/no) in Totalum
- Password hashing is automatic via Better Auth
- Session duration configurable in `src/lib/auth.ts`
