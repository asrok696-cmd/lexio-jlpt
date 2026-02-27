// app/api/stripe/portal/route.ts
import "server-only";

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { stripe, getAppUrl } from "@/app/_lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** clerkClient の users を環境差で安全に取る */
async function getClerkUsers() {
  const c: any = await (clerkClient as any)();
  return c?.users ?? (clerkClient as any).users;
}

/**
 * POST /api/stripe/portal
 * - Clerk privateMetadata.stripeCustomerId を使って Customer Portal を開く
 * - 終了したら /pricing に戻す
 */
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const users = await getClerkUsers();
    const u = await users.getUser(userId);

    const customerId = String((u.privateMetadata as any)?.stripeCustomerId ?? "").trim();
    if (!customerId) {
      return NextResponse.json({ ok: false, error: "NO_STRIPE_CUSTOMER_ID" }, { status: 400 });
    }

    // Customer が存在するかチェック（消えてたらBAD）
    try {
      const c = await stripe.customers.retrieve(customerId);
      if ((c as any)?.deleted) {
        return NextResponse.json({ ok: false, error: "STRIPE_CUSTOMER_DELETED" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "BAD_STRIPE_CUSTOMER_ID" }, { status: 400 });
    }

    const appUrl = getAppUrl();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/pricing`, // ✅ ポータル終了後にここへ戻る
    });

    return NextResponse.json({ ok: true, url: portalSession.url });
  } catch (e: any) {
    console.error("[stripe/portal] error", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}