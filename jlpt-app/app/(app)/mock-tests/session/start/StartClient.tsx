// app/(app)/mock-tests/session/start/StartClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { safeParsePaper, fmtSec, type MockPaperV1 } from "@/app/_lib/mockEngine";
import { getPlan, isMockSlotLocked, type JLPTLevel, type Plan } from "@/app/_lib/entitlements";

type SP = Record<string, string | string[] | undefined>;

function spGet(sp: SP, key: string): string | null {
  const v = sp?.[key];
  if (Array.isArray(v)) return v[0] ?? null;
  return typeof v === "string" ? v : null;
}

function cardStyle(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    padding: 16,
  };
}

function pillStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(255,255,255,0.88)",
    whiteSpace: "nowrap",
  };
}

export default function StartClient({ searchParams }: { searchParams: SP }) {
  const router = useRouter();

  const level = (spGet(searchParams, "level") ?? "N5") as JLPTLevel;
  const slot = Number(spGet(searchParams, "slot") ?? "1") || 1;

  const [paper, setPaper] = useState<MockPaperV1 | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [plan, setPlan] = useState<Plan>("free");
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const p = getPlan();
    setPlan(p);
    setLocked(isMockSlotLocked(p, slot));
  }, [slot]);

  useEffect(() => {
    let canceled = false;

    async function load() {
      setLoadErr(null);
      setPaper(null);

      try {
        const res = await fetch(
          `/mock-data/${encodeURIComponent(level)}/slot-${encodeURIComponent(String(slot))}.json`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Paper not found: ${res.status}`);

        const json = await res.json();
        const parsed = safeParsePaper(json);
        if (!parsed) throw new Error("Invalid paper JSON format");
        if (canceled) return;

        setPaper(parsed);
      } catch (e: any) {
        if (canceled) return;
        setLoadErr(e?.message ?? "Failed to load");
      }
    }

    load();
    return () => {
      canceled = true;
    };
  }, [level, slot]);

  const qCount = paper?.questions?.length ?? 0;
  const timeLimit = paper?.timeLimitSec ?? 0;

  const passPercent = useMemo(() => {
    const n = Number((paper as any)?.passPercent ?? 60);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 60;
  }, [paper]);

  const minSkillPercent = useMemo(() => {
    const n = Number((paper as any)?.minSkillPercent ?? 40);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 40;
  }, [paper]);

  function startExam() {
    if (!paper) return;
    if (locked) return;

    const startedAtISO = new Date().toISOString();
    router.push(
      `/mock-tests/session/exam?level=${encodeURIComponent(level)}&slot=${encodeURIComponent(
        String(slot)
      )}&start=${encodeURIComponent(startedAtISO)}`
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "rgba(255,255,255,0.92)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 950 }}>{paper?.title ?? `Mock · ${level} · Slot ${slot}`}</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              {locked ? "Locked — upgrade to Pro" : "Ready · review details then start"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/mock-tests" style={{ ...pillStyle(), textDecoration: "none" }}>
              ← Back
            </Link>
            <Link href="/pricing" style={{ ...pillStyle(), textDecoration: "none" }}>
              Pricing
            </Link>
            <span style={pillStyle()}>{plan === "pro" ? "Pro" : "Free"}</span>
          </div>
        </div>

        {locked ? (
          <div style={{ marginTop: 14, ...cardStyle() }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>🔒 This mock is locked</div>
            <div style={{ marginTop: 8, opacity: 0.8, lineHeight: 1.6 }}>
              Free plan includes <b>Slot 1 only</b>. Slots 2–11 require Pro.
            </div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Link
                href="/pricing"
                style={{
                  textDecoration: "none",
                  borderRadius: 14,
                  padding: "12px 14px",
                  background: "white",
                  color: "black",
                  fontWeight: 950,
                  textAlign: "center",
                }}
              >
                Upgrade →
              </Link>
              <Link
                href="/mock-tests"
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
                Back →
              </Link>
            </div>
          </div>
        ) : null}

        {!locked && loadErr ? (
          <div style={{ marginTop: 14, ...cardStyle() }}>
            <div style={{ fontWeight: 950 }}>Failed to load mock data</div>
            <div style={{ marginTop: 8, opacity: 0.8 }}>{loadErr}</div>
            <div style={{ marginTop: 12, opacity: 0.8, lineHeight: 1.6 }}>
              Check file exists at: <b>/public/mock-data/{level}/slot-{slot}.json</b>
            </div>
          </div>
        ) : null}

        {!locked && paper ? (
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            <div style={cardStyle()}>
              <div style={{ fontWeight: 950, fontSize: 18 }}>Exam info</div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={pillStyle()}>Level {level}</span>
                <span style={pillStyle()}>Slot {slot}</span>
                <span style={pillStyle()}>Questions {qCount}</span>
                <span style={pillStyle()}>Time {fmtSec(timeLimit)}</span>
              </div>

              <div style={{ marginTop: 12, opacity: 0.82, lineHeight: 1.7 }}>
                Pass rule:
                <br />
                • Total ≥ <b>{passPercent}%</b>
                <br />
                • Each skill ≥ <b>{minSkillPercent}%</b>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={startExam}
                  style={{
                    borderRadius: 14,
                    padding: "12px 14px",
                    background: "white",
                    color: "black",
                    fontWeight: 950,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Start Exam →
                </button>

                <Link
                  href="/mock-tests"
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
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}