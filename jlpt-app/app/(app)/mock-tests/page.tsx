// app/(app)/mock-tests/page.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { getPlan, isMockSlotLocked, type JLPTLevel, type Plan } from "@/app/_lib/entitlements";

const LEVELS: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];
const SLOTS = Array.from({ length: 11 }, (_, i) => i + 1);

// -----------------------------
// Reports-like UI atoms
// -----------------------------
const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 18% 18%, rgba(120,90,255,0.16) 0%, rgba(0,0,0,0.0) 35%), radial-gradient(circle at 70% 25%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.0) 40%), #050507",
  color: "rgba(255,255,255,0.92)",
};

const container: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: 24 };

function SoftCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.05)",
        padding: 16,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.25) inset",
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(120,90,255,0.22)" : "rgba(255,255,255,0.06)",
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(255,255,255,0.88)",
    whiteSpace: "nowrap",
    userSelect: "none",
  };

  if (!onClick) return <div style={base}>{children}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...base,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function NavBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(0,0,0,0.22)",
        color: "rgba(255,255,255,0.92)",
        textDecoration: "none",
        fontWeight: 900,
        fontSize: 13,
      }}
    >
      {children}
    </Link>
  );
}

const chartFrame: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
  padding: 14,
  boxSizing: "border-box",
};

function slotCardStyle(locked: boolean): React.CSSProperties {
  return {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: locked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
    padding: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    color: locked ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.92)",
    opacity: locked ? 0.75 : 1,
  };
}

export default function MockTestsPage() {
  const [mounted, setMounted] = useState(false);
  const [plan, setPlan] = useState<Plan>("free");
  const [level, setLevel] = useState<JLPTLevel>("N5");

  useEffect(() => {
    setMounted(true);

    const refresh = () => {
      try {
        setPlan(getPlan());
      } catch {
        // fail-soft
      }
    };

    // initial
    refresh();

    // localStorage (dev) + manual dispatch
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);

    // ✅ Clerk metadata が変わっても storage は発火しないことが多い
    // → 画面復帰・タブ復帰のタイミングで再評価
    const onFocus = () => refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    // ✅ Clerkが遅れてwindowに乗るケースの吸収（短時間だけポーリング）
    const start = Date.now();
    const itv = window.setInterval(() => {
      refresh();
      if (Date.now() - start > 6000) window.clearInterval(itv); // 6秒で停止
    }, 350);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(itv);
    };
  }, []);

  const accessLabel = useMemo(() => (plan === "pro" ? "Pro" : "Free"), [plan]);
  const accessSub = useMemo(() => {
    if (plan === "pro") return "Unlock 11 mocks per level (Slots 1–11).";
    return "Free plan includes Slot 1 only. Slots 2–11 require Pro.";
  }, [plan]);

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
            <div style={{ fontSize: 44, fontWeight: 950, letterSpacing: -0.5 }}>Mock Tests</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>Full-length · timed · scored</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <NavBtn href="/dashboard">Dashboard</NavBtn>
            <NavBtn href="/diagnostic">Diagnostic</NavBtn>
            <NavBtn href="/practice">Practice</NavBtn>
            <NavBtn href="/reports">Reports</NavBtn>
          </div>
        </div>

        {/* Access */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Access</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>{accessLabel}</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>{accessSub}</div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>{plan === "pro" ? "✅ Pro unlocked" : "🔒 Free"}</Pill>
                <Pill>levels N5–N1</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {plan === "free" ? (
                <Link
                  href="/pricing"
                  style={{
                    textDecoration: "none",
                    borderRadius: 14,
                    padding: "12px 14px",
                    background: "rgba(120, 90, 255, 0.92)",
                    color: "white",
                    fontWeight: 950,
                    textAlign: "center",
                  }}
                >
                  Upgrade to Pro →
                </Link>
              ) : (
                <div
                  style={{
                    borderRadius: 14,
                    padding: "12px 14px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.85)",
                    fontWeight: 950,
                    textAlign: "center",
                  }}
                >
                  Pro active
                </div>
              )}

              <Link
                href="/practice"
                style={{
                  textDecoration: "none",
                  borderRadius: 14,
                  padding: "12px 14px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  fontWeight: 950,
                  textAlign: "center",
                }}
              >
                Go Practice →
              </Link>
            </div>
          </SoftCard>
        </div>

        {/* Level selector + Slots */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 12 }}>
          {/* Left: Level selector */}
          <SoftCard>
            <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Choose level</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Level</div>

            <div style={{ marginTop: 12, ...chartFrame }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {LEVELS.map((lv) => (
                  <Pill key={lv} active={lv === level} onClick={() => setLevel(lv)}>
                    {lv}
                  </Pill>
                ))}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.6 }}>
                Select a level. Slots will appear on the right.
              </div>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
              Tip: Free = Slot 1 only. Pro = Slots 1–11.
            </div>
          </SoftCard>

          {/* Right: Slots for selected level */}
          <SoftCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Mock list</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>{level} slots</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>{SLOTS.length} available</Pill>
                <Pill>{plan === "pro" ? "All unlocked" : "Slot 1 free"}</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, ...chartFrame }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                {SLOTS.map((slot) => {
                  const locked = isMockSlotLocked(plan, slot);

                  const href = `/mock-tests/session/start?level=${encodeURIComponent(level)}&slot=${encodeURIComponent(
                    String(slot)
                  )}`;

                  if (locked) {
                    return (
                      <div key={slot} style={slotCardStyle(true)} title="Locked (upgrade to Pro)">
                        <div style={{ display: "grid", gap: 2 }}>
                          <div style={{ fontWeight: 950 }}>Slot {slot}</div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>Locked</div>
                        </div>
                        <div style={{ fontSize: 14, opacity: 0.9 }}>🔒</div>
                      </div>
                    );
                  }

                  return (
                    <Link key={slot} href={href} style={{ textDecoration: "none" }}>
                      <div style={slotCardStyle(false)}>
                        <div style={{ display: "grid", gap: 2 }}>
                          <div style={{ fontWeight: 950 }}>Slot {slot}</div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>Timed · scored</div>
                        </div>
                        <div style={{ fontSize: 16, opacity: 0.9 }}>→</div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                Result is saved when you finish. (Start: <b>/mock-tests/session/start</b>)
              </div>
            </div>
          </SoftCard>
        </div>
      </div>
    </main>
  );
}