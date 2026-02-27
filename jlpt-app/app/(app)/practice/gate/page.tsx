// app/practice/gate/page.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getPlan, requiresPracticeAd, type Plan } from "@/app/_lib/entitlements";
import { ROADMAP_KEY, type RoadmapWeekV1, readJSON as readRoadmapJSON } from "@/app/_lib/roadmap";

const AD_GATE_PASS_KEY = "lexio.practiceAdGatePass.v1";

const pageWrap: React.CSSProperties = { minHeight: "100vh", background: "#000", color: "rgba(255,255,255,0.92)" };
const container: React.CSSProperties = { maxWidth: 980, margin: "0 auto", padding: 24 };

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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        fontSize: 12,
        fontWeight: 900,
        color: "rgba(255,255,255,0.85)",
        whiteSpace: "nowrap",
        boxSizing: "border-box",
      }}
    >
      {children}
    </span>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        fontSize: 13,
        opacity: 0.86,
        textDecoration: "none",
        color: "rgba(255,255,255,0.92)",
        padding: "6px 8px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.03)",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      {children}
    </Link>
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
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        maxWidth: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: "none",
        background: disabled ? "rgba(255,255,255,0.10)" : "rgba(120, 90, 255, 0.92)",
        color: "white",
        fontWeight: 950,
        cursor: disabled ? "not-allowed" : "pointer",
        boxSizing: "border-box",
        lineHeight: 1.2,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        color: "white",
        fontWeight: 950,
        textDecoration: "none",
        boxSizing: "border-box",
        lineHeight: 1.2,
        opacity: 0.95,
      }}
    >
      {children}
    </Link>
  );
}

function isValidDateISO(x: string | null): x is string {
  return !!x && /^\d{4}-\d{2}-\d{2}$/.test(x);
}

function roadmapDateForDayIndex(dayIndex: number): string | null {
  const rm = readRoadmapJSON<RoadmapWeekV1>(ROADMAP_KEY);
  const d = rm?.days?.find((x: any) => Number(x?.dayIndex) === dayIndex) ?? null;
  return typeof d?.dateISO === "string" ? d.dateISO : null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type GatePassStore = {
  // dateISO -> passedAtISO
  byDate: Record<string, string>;
  updatedAtISO: string;
};

function nowISO() {
  return new Date().toISOString();
}

function readGatePass(): GatePassStore {
  if (typeof window === "undefined") return { byDate: {}, updatedAtISO: "" };
  try {
    const raw = localStorage.getItem(AD_GATE_PASS_KEY);
    if (!raw) return { byDate: {}, updatedAtISO: "" };
    const v = JSON.parse(raw) as GatePassStore;
    if (v?.byDate) return v;
    return { byDate: {}, updatedAtISO: "" };
  } catch {
    return { byDate: {}, updatedAtISO: "" };
  }
}

function writeGatePass(next: GatePassStore) {
  if (typeof window === "undefined") return;
  next.updatedAtISO = nowISO();
  localStorage.setItem(AD_GATE_PASS_KEY, JSON.stringify(next));
}

export default function PracticeGatePage() {
  const router = useRouter();
  const sp = useSearchParams();

  const dayIndex = Math.max(1, Number(sp.get("day") ?? "1") || 1);

  // ✅ A-plan: always carry dateISO forward
  const dateISO = useMemo(() => {
    const q = sp.get("date");
    if (isValidDateISO(q)) return q;
    const fromRoadmap = roadmapDateForDayIndex(dayIndex);
    if (isValidDateISO(fromRoadmap)) return fromRoadmap;
    return todayISO(); // safe fallback
  }, [sp, dayIndex]);

  const [plan, setPlan] = useState<Plan>("free");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPlan(getPlan());
  }, []);

  const needAd = useMemo(() => requiresPracticeAd(plan), [plan]);

  const alreadyPassedToday = useMemo(() => {
    const s = readGatePass();
    return !!s.byDate?.[dateISO];
  }, [dateISO]);

  const nextHref = useMemo(() => {
    return `/practice/pick?day=${encodeURIComponent(String(dayIndex))}&date=${encodeURIComponent(dateISO)}`;
  }, [dayIndex, dateISO]);

  // ✅ Pro OR already passed => skip gate
  useEffect(() => {
    if (!needAd || alreadyPassedToday) {
      router.replace(nextHref);
    }
  }, [needAd, alreadyPassedToday, router, nextHref]);

  if (!needAd || alreadyPassedToday) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div style={{ fontWeight: 950 }}>Redirecting…</div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              {needAd ? "Ad already completed for this date." : "Pro: no ads."}
            </div>
          </SoftCard>
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
            <div style={{ fontSize: 28, fontWeight: 950 }}>Ad Gate</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Free plan requires an ad before starting practice.</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <NavLink href="/practice">← Practice</NavLink>
          </div>
        </div>

        {/* Gate card */}
        <div style={{ marginTop: 14 }}>
          <SoftCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Ad placeholder</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>plan {plan}</Pill>
                <Pill>day {dayIndex}</Pill>
                <Pill>date {dateISO}</Pill>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.78, lineHeight: 1.6 }}>
              This is a dev stub. In production, show a rewarded video and unlock on completion.
            </div>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
              <PrimaryBtn
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  // mark pass for this date
                  const s = readGatePass();
                  s.byDate = s.byDate ?? {};
                  s.byDate[dateISO] = nowISO();
                  writeGatePass(s);

                  router.push(nextHref);
                }}
              >
                {busy ? "Continuing…" : "Complete Ad →"}
              </PrimaryBtn>

              <GhostLink href="/practice">Cancel →</GhostLink>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
              key: <b>{AD_GATE_PASS_KEY}</b>
            </div>
          </SoftCard>
        </div>
      </div>
    </main>
  );
}