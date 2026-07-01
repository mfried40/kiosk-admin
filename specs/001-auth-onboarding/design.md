# 001 — Auth & Onboarding: Design

## Components

### `app/setup/page.tsx` (Server Component)
- Query `db.user.count()` server-side.
- If count > 0, call `notFound()`.
- Render `<SetupForm />`.

### `app/setup/SetupForm.tsx` (Client Component)
- Fields: email, password, confirm password.
- Client-side validation: email format, password length ≥ 12, passwords match.
- Calls `POST /api/auth/setup`.

### `app/api/auth/setup/route.ts`
- Validate body with Zod: `{ email: z.string().email(), password: z.string().min(12) }`.
- Guard: if any user exists, return `409 Conflict`.
- Hash password with `bcrypt(password, 12)`.
- Insert `User` with role `ADMIN`.
- Return `201`.

### `app/(auth)/login/page.tsx`
- Standard NextAuth `signIn("credentials", ...)` form.
- Redirect to `/` on success.

### `lib/auth.ts`
- NextAuth config: credentials provider, JWT strategy.
- `authorize` callback: lookup user by email, compare bcrypt hash, return `{ id, email, role }`.
- `jwt` callback: embed `role` in token.
- `session` callback: surface `role` on `session.user`.

### Middleware (`middleware.ts`)
- Match all routes except `/login`, `/setup`, `/api/auth/**`.
- Redirect to `/login` if no valid session token.
- Pass `role` to downstream request via header for API route guards.

## Data Model (relevant slice)
```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(VIEWER)
  createdAt    DateTime @default(now())
}

enum Role {
  ADMIN
  VIEWER
}
```

## Error Handling
- Invalid credentials: return `401`, generic message — no enumeration.
- Setup race (two tabs): second request hits guard and returns `409`.
- Missing `NEXTAUTH_SECRET`: NextAuth throws at startup — let it crash rather than run insecurely.
