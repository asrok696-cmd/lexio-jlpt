// app/api/stripe/checkout/route.ts
import "server-only";

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

import { stripe, getAppUrl, getProPriceId } from "@/app/_lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    // Clerkユーザー取得（emailを取りたい）
    const client = await clerkClient();
    const u = await client.users.getUser(userId);

    const email =
      u.primaryEmailAddress?.emailAddress ||
      u.emailAddresses?.[0]?.emailAddress ||
      null;

    // 既に保存済みの stripeCustomerId があればそれを再利用
    const existingCustomerId = String((u.privateMetadata as any)?.stripeCustomerId ?? "").trim();

    let customerId = existingCustomerId;

    // 無ければ Stripe Customer を作る（ここが重要）
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        metadata: { userId },
      });
      customerId = customer.id;

      // ✅ Clerk privateMetadata に保存（Portal用）
      await client.users.updateUser(userId, {
        privateMetadata: {
          ...(u.privateMetadata ?? {}),
          stripeCustomerId: customerId,
        },
      });
    }

    const body = await req.json().catch(() => ({}));
    const priceId = String(body?.priceId ?? getProPriceId());
    const appUrl = getAppUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId, // ✅ ここがポイント（Portalに必須のCustomerを固定）
      line_items: [{ price: priceId, quantity: 1 }],

      success_url: `${appUrl}/pricing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?canceled=1`,

      metadata: { userId, plan: "pro" },
      subscription_data: { metadata: { userId } },

      allow_promotion_codes: true,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: any) {
    console.error("[stripe/checkout] error", e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}