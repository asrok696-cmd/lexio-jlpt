// app/api/stripe/webhook/route.ts
import "server-only";

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { clerkClient } from "@clerk/nextjs/server";

import type Stripe from "stripe"; // ✅ これを足す（Stripe.Event のため）
import { stripe, getWebhookSecret } from "@/app/_lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getClerkUsers() {
  // 環境によって clerkClient が Promise を返す型になることがあるので吸収
  const c: any = await (clerkClient as any)();
  return c?.users ?? (clerkClient as any).users;
}

async function setUserPlan(args: {
  userId: string;
  plan: "pro" | "free";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  const users = await getClerkUsers();
  const { userId, plan, stripeCustomerId, stripeSubscriptionId } = args;

  await users.updateUser(userId, {
    publicMetadata: {
      plan,
      planUpdatedAt: new Date().toISOString(),
    },
    privateMetadata: {
      ...(stripeCustomerId ? { stripeCustomerId } : {}),
      ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
    },
  });
}

async function resolveUserIdFromCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  try {
    const c = await stripe.customers.retrieve(customerId);
    if ((c as any)?.deleted) return null;
    const uid = String((c as any)?.metadata?.userId ?? "").trim();
    return uid || null;
  } catch {
    return null;
  }
}

async function ensureCustomerHasUserId(customerId: string | null, userId: string) {
  if (!customerId) return;
  try {
    const c = await stripe.customers.retrieve(customerId);
    if ((c as any)?.deleted) return;

    const cur = String((c as any)?.metadata?.userId ?? "").trim();
    if (cur === userId) return;

    await stripe.customers.update(customerId, {
      metadata: {
        ...(c as any)?.metadata,
        userId,
      },
    });
  } catch {
    // best-effort
  }
}

export async function POST(req: Request) {
  const webhookSecret = getWebhookSecret();

  const sig = (await headers()).get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ ok: false, error: "NO_SIGNATURE" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await req.text(); // raw body required
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret) as Stripe.Event;
  } catch (err: any) {
    console.error("[stripe/webhook] signature verify failed:", err?.message ?? err);
    return NextResponse.json({ ok: false, error: "BAD_SIGNATURE" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;

        const customerId = session?.customer ? String(session.customer) : null;
        const subId = session?.subscription ? String(session.subscription) : null;

        let userId = String(session?.metadata?.userId ?? "").trim();
        if (!userId) {
          userId = (await resolveUserIdFromCustomer(customerId)) ?? "";
        }

        if (!userId) {
          console.warn("[stripe/webhook] checkout.session.completed missing userId");
          break;
        }

        await ensureCustomerHasUserId(customerId, userId);

        await setUserPlan({
          userId,
          plan: "pro",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subId,
        });

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as any;

        const customerId = sub?.customer ? String(sub.customer) : null;
        const subId = sub?.id ? String(sub.id) : null;

        let userId = String(sub?.metadata?.userId ?? "").trim();
        if (!userId) {
          userId = (await resolveUserIdFromCustomer(customerId)) ?? "";
        }

        if (!userId) {
          console.warn("[stripe/webhook] subscription.deleted missing userId");
          break;
        }

        await setUserPlan({
          userId,
          plan: "free",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subId,
        });

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[stripe/webhook] handler error", e);
    return NextResponse.json({ ok: false, error: "WEBHOOK_HANDLER_FAILED" }, { status: 500 });
  }
}