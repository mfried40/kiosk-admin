# 001 — Auth & Onboarding: Requirements

## User Stories

### US-001-1: First-run setup
As a new installer, I want to be guided through creating the first admin account on first boot, so that the application is secured before it is accessible.

**Acceptance criteria**
- WHEN the application starts and no `User` rows exist in the database, the system SHALL redirect all unauthenticated requests to `/setup`.
- WHEN a user submits the setup form with a valid email and password, the system SHALL create a `User` record with role `ADMIN` and hash the password with bcrypt (cost ≥ 12).
- WHEN a `User` row already exists, the system SHALL make the `/setup` route return a `404`.
- IF the setup form is submitted with a password shorter than 12 characters, the system SHALL reject it with a validation error and SHALL NOT create any user.

### US-001-2: Login
As an admin or viewer, I want to sign in with email and password, so that I can access the kiosk dashboard.

**Acceptance criteria**
- WHEN a user submits correct credentials, the system SHALL create a NextAuth session and redirect to `/`.
- WHEN a user submits incorrect credentials, the system SHALL return a generic "Invalid credentials" error — it SHALL NOT indicate whether the email or password was wrong.
- WHILE a session is active, the system SHALL include the user's `role` in the session token.
- IF a session expires, the system SHALL redirect the user to `/login` on their next navigation.

### US-001-3: Role-based access
As an admin, I want viewers to be prevented from sending commands, so that read-only users cannot accidentally affect devices.

**Acceptance criteria**
- WHILE a user has role `VIEWER`, the system SHALL return `403` for any API route that mutates device state.
- WHILE a user has role `VIEWER`, the system SHALL hide all action buttons in the UI that require `ADMIN` role.
- WHEN an unauthenticated request reaches any protected API route, the system SHALL return `401`.

### US-001-4: Sign out
As any authenticated user, I want to sign out, so that my session is not left open on a shared machine.

**Acceptance criteria**
- WHEN a user clicks "Sign out", the system SHALL invalidate the NextAuth session and redirect to `/login`.

---

## Non-functional Requirements
- Passwords must be stored as bcrypt hashes — never plaintext.
- Session tokens are signed with `NEXTAUTH_SECRET`; absence of this env var at startup is a fatal error.
- The `/setup` check (user count = 0) must be evaluated server-side on every request to the route, not cached.

## Out of Scope
- OAuth / SSO provider login (Google, GitHub, etc.) — credentials only for now.
- Password reset flow — manual DB edit for now.
- Multi-user self-registration.
