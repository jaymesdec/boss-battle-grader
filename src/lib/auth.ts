import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import type { OAuthConfig } from "next-auth/providers";

const CANVAS_DOMAIN = process.env.CANVAS_DOMAIN ?? "franklinjc.instructure.com";
const CANVAS_ISSUER = `https://${CANVAS_DOMAIN}`;
const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL ?? CANVAS_ISSUER;
const FRANKLIN_DOMAIN = "franklinjc.instructure.com";

type ProviderAccount = {
  provider?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
};

interface ExtendedJWT extends JWT {
  canvasAccessToken?: string;
  canvasRefreshToken?: string;
  canvasExpiresAt?: number;
  isFranklinTeacher?: boolean;
  canvasDomain?: string;
  error?: string;

  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleExpiresAt?: number;
}

type CanvasEnrollment = {
  type?: string;
  role?: string;
  role_id?: number;
};

type CanvasCourse = {
  id: number;
  name: string;
  enrollments?: CanvasEnrollment[];
};

async function refreshCanvasAccessToken(token: ExtendedJWT): Promise<ExtendedJWT> {
  if (!token.canvasRefreshToken) {
    return { ...token, error: "CanvasRefreshTokenMissing" };
  }

  try {
    const response = await fetch(`${CANVAS_ISSUER}/login/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.CANVAS_CLIENT_ID!,
        client_secret: process.env.CANVAS_CLIENT_SECRET!,
        refresh_token: token.canvasRefreshToken,
      }),
    });

    const refreshed = await response.json();

    if (!response.ok) {
      throw refreshed;
    }

    return {
      ...token,
      canvasAccessToken: refreshed.access_token,
      canvasExpiresAt: Date.now() + refreshed.expires_in * 1000,
      canvasRefreshToken: refreshed.refresh_token ?? token.canvasRefreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error("Error refreshing Canvas token", error);
    return { ...token, error: "CanvasRefreshAccessTokenError" };
  }
}

async function refreshGoogleAccessToken(token: ExtendedJWT): Promise<ExtendedJWT> {
  if (!token.googleRefreshToken) {
    return token;
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.googleRefreshToken,
      }),
    });

    const refreshed = await response.json();

    if (!response.ok) {
      throw refreshed;
    }

    return {
      ...token,
      googleAccessToken: refreshed.access_token,
      googleExpiresAt: Date.now() + refreshed.expires_in * 1000,
      googleRefreshToken: refreshed.refresh_token ?? token.googleRefreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error("Error refreshing Google access token", error);
    return { ...token, error: "GoogleRefreshAccessTokenError" };
  }
}

function hasTeacherLevelAccess(enrollments: CanvasEnrollment[] = []): boolean {
  const teacherPatterns = [/teacher/i, /instructor/i, /ta/i, /teaching assistant/i];

  return enrollments.some((enrollment) => {
    const haystack = `${enrollment.type ?? ""} ${enrollment.role ?? ""}`.trim();
    return teacherPatterns.some((pattern) => pattern.test(haystack));
  });
}

async function verifyFranklinTeacher(accessToken: string): Promise<{ ok: true; courses: number } | { ok: false; reason: string }> {
  const domainOk = CANVAS_DOMAIN.toLowerCase() === FRANKLIN_DOMAIN;
  if (!domainOk) {
    return { ok: false, reason: "Canvas domain is not allowed" };
  }

  const response = await fetch(
    `${CANVAS_BASE_URL}/api/v1/courses?enrollment_type=teacher&state[]=available&include[]=teachers&include[]=term&per_page=25`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return { ok: false, reason: `Canvas verification failed (${response.status})` };
  }

  const courses = (await response.json()) as CanvasCourse[];
  const teacherCourses = courses.filter((course) => hasTeacherLevelAccess(course.enrollments));

  if (teacherCourses.length === 0) {
    return { ok: false, reason: "No Franklin teacher-level enrollments found" };
  }

  return { ok: true, courses: teacherCourses.length };
}

const providers: OAuthConfig<unknown>[] = [];

if (process.env.CANVAS_CLIENT_ID && process.env.CANVAS_CLIENT_SECRET) {
  providers.push({
    id: "canvas",
    name: "Canvas (Franklin)",
    type: "oauth",
    clientId: process.env.CANVAS_CLIENT_ID,
    clientSecret: process.env.CANVAS_CLIENT_SECRET,
    issuer: CANVAS_ISSUER,
    authorization: {
      url: `${CANVAS_ISSUER}/login/oauth2/auth`,
      params: {
        scope: "url:GET|/api/v1/users/self profile",
      },
    },
    token: `${CANVAS_ISSUER}/login/oauth2/token`,
    userinfo: `${CANVAS_BASE_URL}/api/v1/users/self/profile`,
    checks: ["state"],
    profile(profile) {
      return {
        id: String((profile as { id: number }).id),
        name: (profile as { name?: string }).name,
        email: (profile as { primary_email?: string }).primary_email,
        image: (profile as { avatar_url?: string }).avatar_url,
      };
    },
  });
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope:
            "openid email profile https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/presentations.readonly",
        },
      },
    }) as OAuthConfig<unknown>
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  providers,
  callbacks: {
    async signIn({ account }) {
      const typedAccount = account as ProviderAccount | null;
      if (!typedAccount || typedAccount.provider !== "canvas" || !typedAccount.access_token) {
        return true;
      }

      const verification = await verifyFranklinTeacher(typedAccount.access_token);
      if (!verification.ok) {
        console.warn(`Canvas sign-in denied: ${verification.reason}`);
        return false;
      }

      return true;
    },
    async jwt({ token, account }) {
      const extToken = token as ExtendedJWT;
      const typedAccount = account as ProviderAccount | null;

      if (typedAccount?.provider === "canvas") {
        extToken.canvasAccessToken = typedAccount.access_token;
        extToken.canvasRefreshToken = typedAccount.refresh_token;
        extToken.canvasExpiresAt = typedAccount.expires_at ? typedAccount.expires_at * 1000 : undefined;
        extToken.canvasDomain = CANVAS_DOMAIN;
        extToken.isFranklinTeacher = true;
      }

      if (typedAccount?.provider === "google") {
        extToken.googleAccessToken = typedAccount.access_token;
        extToken.googleRefreshToken = typedAccount.refresh_token;
        extToken.googleExpiresAt = typedAccount.expires_at ? typedAccount.expires_at * 1000 : undefined;
      }

      if (extToken.canvasAccessToken && extToken.canvasExpiresAt && Date.now() > extToken.canvasExpiresAt) {
        return refreshCanvasAccessToken(extToken);
      }

      if (extToken.googleAccessToken && extToken.googleExpiresAt && Date.now() > extToken.googleExpiresAt) {
        return refreshGoogleAccessToken(extToken);
      }

      return extToken;
    },
    async session({ session, token }) {
      const extToken = token as ExtendedJWT;
      session.canvasAccessToken = extToken.canvasAccessToken;
      session.googleAccessToken = extToken.googleAccessToken;
      session.accessToken = extToken.googleAccessToken;
      session.error = extToken.error;
      session.isFranklinTeacher = extToken.isFranklinTeacher ?? false;
      session.canvasDomain = extToken.canvasDomain;
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
        return true;
      }

      return !!auth?.user;
    },
  },
  pages: {
    signIn: "/login",
  },
});