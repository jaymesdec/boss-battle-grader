import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
  }
}

// Extend JWT type inline since module augmentation doesn't work in v5
interface ExtendedJWT extends JWT {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: string;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: "openid email profile https://www.googleapis.com/auth/documents.readonly",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      const extToken = token as ExtendedJWT;

      // Initial sign-in: store tokens
      if (account) {
        return {
          ...extToken,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at ? account.expires_at * 1000 : undefined,
        } as ExtendedJWT;
      }

      // Token still valid
      if (extToken.expiresAt && Date.now() < extToken.expiresAt) {
        return extToken;
      }

      // Token expired, try to refresh
      if (extToken.refreshToken) {
        try {
          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: "refresh_token",
              refresh_token: extToken.refreshToken,
            }),
          });

          const refreshedTokens = await response.json();

          if (!response.ok) {
            throw refreshedTokens;
          }

          return {
            ...extToken,
            accessToken: refreshedTokens.access_token,
            expiresAt: Date.now() + refreshedTokens.expires_in * 1000,
            refreshToken: refreshedTokens.refresh_token ?? extToken.refreshToken,
          } as ExtendedJWT;
        } catch (error) {
          console.error("Error refreshing access token", error);
          return { ...extToken, error: "RefreshAccessTokenError" } as ExtendedJWT;
        }
      }

      return extToken;
    },
    async session({ session, token }) {
      const extToken = token as ExtendedJWT;
      session.accessToken = extToken.accessToken;
      session.error = extToken.error;
      return session;
    },
  },
});
