// app/(app)/pricing/page.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";

import { getPlan, setPlan, type Plan } from "@/app/_lib/entitlements";
import { pageWrap, container, SoftCard, Pill, NavBtn, frame } from "@/app/_components/AppShell";

const FREE_SLOTS = 1;
const PRO_SLOTS = 11;

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "14px 0" }} />;
}

function FeatureRow({ text, ok = true }: { text: string; ok?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ width: 18, opacity: ok ? 1 : 0.6 }}>{ok ? "✓" : "—"}</div>
      <div style={{ opacity: ok ? 0.92 : 0.7 }}>{text}</div>
    </div>
  );
}

function PrimaryBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: "none",
        background: disabled ? "rgba(255,255,255,0.10)" : "rgba(120, 90, 255, 0.92)",
        color: "white",
        fontWeight: 950,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function GhostBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        color: "white",
        fontWeight: 950,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 0.95,
      }}
    >
      {children}
    </button>
  );
}

type SyncState =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "synced"; message: string }
  | { kind: "warning"; message: string }
  | { kind: "error"; message: string };

export default function PricingPage() {
  const { isSignedIn, user } = useUser();

  const [mounted, setMounted] = useState(false);
  const [localPlan, setLocalPlan] = useState<Plan>("free");
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>({ kind: "idle" });

  useEffect(() => {
    setMounted(true);
    setLocalPlan(getPlan());

    const onStorage = () => setLocalPlan(getPlan());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Clerk publicMetadata 優先で plan を表示（なければ local fallback）
  const clerkPlan = useMemo(() => {
    const p = (user?.publicMetadata as any)?.plan;
    return p === "pro" ? ("pro" as Plan) : p === "free" ? ("free" as Plan) : null;
  }, [user]);

  const plan: Plan = clerkPlan ?? localPlan;
  const isPro = plan === "pro";
  const slotCap = useMemo(() => (isPro ? PRO_SLOTS : FREE_SLOTS), [isPro]);

  // ✅ Checkout完了後の sync（pricing?success=1&session_id=...）
  useEffect(() => {
    if (!mounted) return;

    const url = new URL(window.location.href);
    const success = url.searchParams.get("success") === "1";
    const canceled = url.searchParams.get("canceled") === "1";
    const sessionId = String(url.searchParams.get("session_id") ?? "").trim();

    if (canceled) {
      setSyncState({ kind: "warning", message: "Checkout canceled." });
      return;
    }

    if (!success) return;

    if (!sessionId) {
      setSyncState({
        kind: "warning",
        message:
          "Checkout returned without session_id. Update success_url to include &session_id={CHECKOUT_SESSION_ID} (then try again).",
      });
      return;
    }

    let alive = true;

    (async () => {
      try {
        setSyncState({ kind: "syncing" });

        const res = await fetch(`/api/stripe/sync?session_id=${encodeURIComponent(sessionId)}`, {
          method: "GET",
        });
        const data = await res.json().catch(() => ({} as any));

        if (!res.ok || !data?.ok) {
          const code = String(data?.error ?? `HTTP_${res.status}`);
          throw new Error(code);
        }

        // ✅ local compat
        setPlan("pro");
        setLocalPlan("pro");

        // Clerk user を最新化
        try {
          await user?.reload();
        } catch {}

        if (!alive) return;

        setSyncState({ kind: "synced", message: "Pro activated ✅" });

        url.searchParams.delete("success");
        url.searchParams.delete("session_id");
        window.history.replaceState({}, "", url.toString());
      } catch (e: any) {
        if (!alive) return;
        setSyncState({
          kind: "error",
          message: `Sync failed: ${String(e?.message ?? e)} (Webhook may still update later)`,
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [mounted, user]);

  async function startStripeCheckout() {
    if (!isSignedIn) {
      setSyncState({ kind: "error", message: "UNAUTHORIZED (ログインしてから試して)" });
      return;
    }

    setLoadingCheckout(true);
    setSyncState({ kind: "idle" });

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || !data?.ok) {
        const code = String(data?.error ?? `HTTP_${res.status}`);
        throw new Error(code);
      }

      const url = String(data?.url ?? "");
      if (!url.startsWith("http")) throw new Error("BAD_CHECKOUT_URL");

      window.location.href = url;
    } catch (e: any) {
      setSyncState({ kind: "error", message: `Checkout failed: ${String(e?.message ?? e)}` });
      setLoadingCheckout(false);
    }
  }

  // ✅ Stripe Customer Portal (解約/支払い方法変更)
  async function openCustomerPortal() {
    if (!isSignedIn) {
      setSyncState({ kind: "error", message: "UNAUTHORIZED (ログインしてから試して)" });
      return;
    }

    setLoadingPortal(true);
    setSyncState({ kind: "idle" });

    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || !data?.ok) {
        const code = String(data?.error ?? `HTTP_${res.status}`);
        throw new Error(code);
      }

      const url = String(data?.url ?? "");
      if (!url.startsWith("http")) throw new Error("BAD_PORTAL_URL");

      window.location.href = url;
    } catch (e: any) {
      setSyncState({ kind: "error", message: `Portal failed: ${String(e?.message ?? e)}` });
      setLoadingPortal(false);
    }
  }

  // dev用：Freeに戻す（ローカル互換）
  function setFreeDev() {
    setPlan("free");
    setLocalPlan("free");
    setSyncState({ kind: "warning", message: "Switched to Free (local-only)." });
  }

  if (!mounted) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>Loading…</SoftCard>
        </div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <div style={container}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 950, letterSpacing: -0.5 }}>Pricing</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              Free: Practice with ads · Mock Slot 1 only · Pro: No ads · Slots 1–11
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <NavBtn href="/dashboard">Dashboard</NavBtn>
            <NavBtn href="/mock-tests">Mock Tests</NavBtn>
            <NavBtn href="/practice">Practice</NavBtn>
            <NavBtn href="/support">Support</NavBtn>
          </div>
        </div>

        {/* Sync banner */}
        {syncState.kind !== "idle" ? (
          <div style={{ marginTop: 12 }}>
            <SoftCard>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>
                  {syncState.kind === "syncing"
                    ? "⏳ syncing…"
                    : syncState.kind === "synced"
                    ? "✅ synced"
                    : syncState.kind === "warning"
                    ? "⚠️ notice"
                    : "⛔ error"}
                </Pill>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  {(syncState as any).message ?? ""}
                </div>
              </div>
            </SoftCard>
          </div>
        ) : null}

        {/* Current plan */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Current</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>
                  {isPro ? "Pro Plan" : "Free Plan"}
                </div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                  {isPro ? "Pro enabled" : "Free enabled"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>{isPro ? "✅ Pro" : "🔒 Free"}</Pill>
                <Pill>Mock slots {slotCap}/{PRO_SLOTS}</Pill>
                <Pill>{isPro ? "No ads" : "Ads in Practice"}</Pill>
                <Pill>{isSignedIn ? "Signed in" : "Not signed in"}</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, ...frame }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {/* Free */}
                <div
                  style={{
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.18)",
                    padding: 14,
                    display: "grid",
                    gap: 10,
                    opacity: plan === "free" ? 1 : 0.95,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>Free</div>
                    <Pill>{plan === "free" ? "Selected" : "Available"}</Pill>
                  </div>

                  <div style={{ opacity: 0.8, fontSize: 13, lineHeight: 1.6 }}>
                    Try the system with minimal access.
                  </div>

                  <Divider />

                  <div style={{ display: "grid", gap: 8, fontSize: 13, opacity: 0.9, lineHeight: 1.6 }}>
                    <FeatureRow text="Practice (with ads)" ok />
                    <FeatureRow text="Mock Tests: Slot 1 only (N5–N1)" ok />
                    <FeatureRow text="Reports + progress tracking" ok />
                    <FeatureRow text="Slots 2–11 locked" ok={false} />
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <GhostBtn onClick={setFreeDev} disabled={plan === "free"}>
                      Use Free (dev) →
                    </GhostBtn>
                  </div>
                </div>

                {/* Pro */}
                <div
                  style={{
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(120, 90, 255, 0.10)",
                    padding: 14,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 950, fontSize: 18 }}>Pro</div>
                    <Pill active>{plan === "pro" ? "Selected" : "Upgrade"}</Pill>
                  </div>

                  <div style={{ opacity: 0.8, fontSize: 13, lineHeight: 1.6 }}>
                    Built for serious JLPT prep.
                  </div>

                  <Divider />

                  <div style={{ display: "grid", gap: 8, fontSize: 13, opacity: 0.9, lineHeight: 1.6 }}>
                    <FeatureRow text="No ads (Practice)" ok />
                    <FeatureRow text="Mock Tests: Slots 1–11 (N5–N1)" ok />
                    <FeatureRow text="Priority support for “feature unusable” issues" ok />
                    <FeatureRow text="Refund policy available in Support" ok />
                  </div>

                  <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
                    {!isPro ? (
                      <PrimaryBtn onClick={startStripeCheckout} disabled={loadingCheckout}>
                        {loadingCheckout ? "Redirecting…" : "Enable Pro → (Stripe)"}
                      </PrimaryBtn>
                    ) : (
                      <GhostBtn onClick={openCustomerPortal} disabled={loadingPortal}>
                        {loadingPortal ? "Opening portal…" : "Manage subscription →"}
                      </GhostBtn>
                    )}
                  </div>

                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72, lineHeight: 1.6 }}>
                    {isPro
                      ? "Manage subscription opens Stripe Customer Portal (cancel / update card)."
                      : "You’ll be redirected to Stripe Checkout. Promotion codes are entered on the Checkout page."}
                  </div>

                  {!isSignedIn ? (
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72 }}>
                      ※ Checkout/Portal にはログインが必要
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </SoftCard>
        </div>

        {/* Notes */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Notes</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>How Free/Pro works</div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>Mock cap: {slotCap} slots</Pill>
                <Pill>Weekly Check: free</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, ...frame }}>
              <div style={{ opacity: 0.78, fontSize: 13, lineHeight: 1.7 }}>
                <div style={{ marginBottom: 10 }}>
                  • Free users can start only <b>Slot 1</b> in each level. Slots 2–11 redirect to Pricing.
                </div>
                <div style={{ marginBottom: 10 }}>
                  • Ads are shown only in <b>Practice</b> for Free users (to avoid negative revenue).
                </div>
                <div style={{ marginBottom: 10 }}>
                  • Refunds are supported only when a paid feature is <b>unusable due to our technical issue</b>. See{" "}
                  <Link href="/support" style={{ color: "rgba(170,140,255,0.95)", fontWeight: 950, textDecoration: "none" }}>
                    Refund policy
                  </Link>
                  .
                </div>
                <div>• Next step: connect Stripe → when payment succeeds, set plan to <b>pro</b>.</div>
              </div>
            </div>
          </SoftCard>
        </div>
      </div>
    </main>
  );
}