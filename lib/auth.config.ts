import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config used only by the middleware.
 * Must NOT import anything that requires Node.js native modules (e.g. bcrypt, prisma).
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isSetup = nextUrl.pathname.startsWith("/setup");
      const isPublic =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/api/auth") ||
        nextUrl.pathname === "/mqtt"; // MQTT WebSocket — broker handles its own auth

      if (isPublic || isSetup) return true;
      return isLoggedIn;
    },
  },
  // Providers are added in the full auth.ts config
  providers: [],
};
