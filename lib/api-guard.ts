/**
 * API route guard helpers.
 * Call these at the top of route handlers to enforce authentication and roles.
 */

import { auth } from "@/lib/auth";
import type { Role } from "@/lib/generated/prisma/client";

export class ApiGuardError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "ApiGuardError";
  }
}

/**
 * Returns the current session or throws ApiGuardError(401) if unauthenticated.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new ApiGuardError(401, "Unauthenticated");
  }
  return session;
}

/**
 * Returns the current session or throws ApiGuardError(401/403) if the user
 * does not have the required role.
 */
export async function requireRole(role: Role) {
  const session = await requireAuth();
  // @ts-expect-error role is injected by our jwt/session callbacks
  const userRole: Role = session.user.role;
  if (userRole !== role) {
    throw new ApiGuardError(403, "Forbidden");
  }
  return session;
}

/**
 * Wraps an ApiGuardError into a NextResponse-compatible Response.
 * Returns null when the error is not an ApiGuardError.
 */
export function guardErrorResponse(err: unknown): Response | null {
  if (err instanceof ApiGuardError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  return null;
}
