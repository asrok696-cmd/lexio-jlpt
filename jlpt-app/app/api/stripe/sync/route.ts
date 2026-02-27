// app/api/stripe/sync/route.ts
import "server-only";

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { stripe } from "@/app/_lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** clerkClient の users を環境差で安全に取る */
async function getClerkUsers() {
  const maybeFn: any = clerkClient as any;

  // clerkClient() 形式
  try {
    const c = await maybeFn();
    if (c?.users) return c.users;
  } catch {
    // ignore
  }

  // clerkClient.users 形式
  if (maybeFn?.users) return maybeFn.users;

  throw new Error("CLERK_CLIENT_SHAPE_UNKNOWN");
}

function toId(x: any): string | null {
  if (!x) return null;
  if (typeof x === "string") return x;
  if (typeof x === "object" && typeof x.id === "string") return x.id;
  return null;
}

/**
 * GET /api/stripe/sync?session_id=cs_test_...
 * - Checkout 完了後に pricing ページから叩く想定
 * - session.metadata.userId とログイン userId が一致するか検証
 * - status=complete を確認して Clerk publicMetadata.plan="pro" に更新
 * - customer/subscription の "id" を確実に保存（expand時の [object Object] 回避）
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const sessionId = String(url.searchParams.get("session_id") ?? "").trim();
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "MISSING_SESSION_ID" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    // ✅ セキュリティ：この session が「今ログインしてる user のもの」か確認
    const sessionUserId = String((session as any)?.metadata?.userId ?? "").trim();
    if (!sessionUserId || sessionUserId !== userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const status = String((session as any)?.status ?? "").trim();

    // ✅ "complete" 以外は弾く
    if (status !== "complete") {
      return NextResponse.json({ ok: false, error: "NOT_COMPLETE", status }, { status: 409 });
    }

    // ✅ expandしてても安全にIDを抜く
    const customerId = toId((session as any).customer);
    const subId = toId((session as any).subscription);

    // customerId が無いのは通常ありえないので明示的にエラー
    if (!customerId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_CUSTOMER_ID", status },
        { status: 500 }
      );
    }

    const users = await getClerkUsers();

    await users.updateUser(userId, {
      publicMetadata: {
        plan: "pro",
        planUpdatedAt: new Date().toISOString(),
      },
      privateMetadata: {
        stripeCustomerId: customerId,
        ...(subId ? { stripeSubscriptionId: subId } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      plan: "pro",
      status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
    });
  } catch (e: any) {
    console.error("[stripe/sync] error", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}