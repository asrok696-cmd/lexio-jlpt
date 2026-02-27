// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Clerk middleware (routing guard)
 *
 * Flow:
 * - /start :
 *   - not signed in -> /sign-in
 *   - signed in & not diagDone -> /diagnostic/phase0
 *   - signed in & diagDone -> /dashboard
 *
 * - /sign-in :
 *   - signed in -> (/dashboard if diagDone else /diagnostic/phase0)
 *
 * - /diagnostic/* :
 *   - requires sign-in
 *   - if diagDone, block /diagnostic/phase0 and /diagnostic/intro
 *
 * - /dashboard :
 *   - requires sign-in + diagDone
 *
 * diagDone source priority:
 * 1) Clerk sessionClaims.metadata.diagDone
 * 2) Cookie fallback: lexio.diag.done.v1 === "1"
 */

const DIAG_DONE_COOKIE = "lexio.diag.done.v1";

// Public routes (no auth required)
const isPublicRoute = createRouteMatcher([
  "/",                 // landing
  "/start",
  "/sign-in(.*)",      // includes /sign-in/sso-callback
]);

// Diagnostic route matcher
const isDiagnosticRoute = createRouteMatcher(["/diagnostic(.*)"]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, sessionClaims, redirectToSignIn } = await auth();
  const isAuthed = !!userId;

  // -----------------------------
  // diagDone resolution
  // -----------------------------

  // A) Clerk metadata (production correct source)
  const diagDoneFromClaims =
    !!(sessionClaims as any)?.metadata?.diagDone;

  // B) Cookie fallback (client-set after phase2)
  const diagDoneFromCookie =
    req.cookies.get(DIAG_DONE_COOKIE)?.value === "1";

  const diagDone = diagDoneFromClaims || diagDoneFromCookie;

  const { pathname } = req.nextUrl;

  // -----------------------------
  // 1) /start auto router
  // -----------------------------
  if (pathname === "/start") {
    if (!isAuthed) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }

    const url = req.nextUrl.clone();
    url.pathname = diagDone
      ? "/dashboard"
      : "/diagnostic/phase0";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // -----------------------------
  // 2) /sign-in forward
  // -----------------------------
  if (pathname.startsWith("/sign-in")) {
    if (!isAuthed) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname = diagDone
      ? "/dashboard"
      : "/diagnostic/phase0";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // -----------------------------
  // 3) /diagnostic/*
  // -----------------------------
  if (isDiagnosticRoute(req)) {
    if (!isAuthed) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }

    // If already finished diagnostic, block entry pages
    if (
      diagDone &&
      (pathname === "/diagnostic/phase0" ||
        pathname === "/diagnostic/intro")
    ) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // -----------------------------
  // 4) Require sign-in for non-public routes
  // -----------------------------
  if (!isPublicRoute(req) && !isAuthed) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // -----------------------------
  // 5) /dashboard guard
  // -----------------------------
  if (pathname === "/dashboard") {
    if (!isAuthed) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }

    if (!diagDone) {
      const url = req.nextUrl.clone();
      url.pathname = "/diagnostic/phase0";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip static + Next internals
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};