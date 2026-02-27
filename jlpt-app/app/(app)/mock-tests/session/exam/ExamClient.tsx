// app/(app)/mock-tests/session/exam/ExamClient.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { JLPTLevel } from "@/app/_lib/entitlements";
import { getPlan, isMockSlotLocked } from "@/app/_lib/entitlements";
import {
  calcResult,
  fmtSec,
  safeParsePaper,
  type MockAnswerMap,
  type MockPaperV1,
} from "@/app/_lib/mockEngine";
import { saveMockResult } from "@/app/_lib/mockStore";

type SP = Record<string, string | string[] | undefined>;

function spGet(sp: SP, key: string): string | null {
  const v = sp?.[key];
  if (Array.isArray(v)) return v[0] ?? null;
  return typeof v === "string" ? v : null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

function cardStyle(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    padding: 16,
  };
}

function parseStartISO(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

export default function ExamClient({ searchParams }: { searchParams: SP }) {
  const router = useRouter();

  const level = ((spGet(searchParams, "level") ?? "N5").toUpperCase() as JLPTLevel) ?? "N5";
  const slot = Number(spGet(searchParams, "slot") ?? "1") || 1;
  const startISOFromQS = parseStartISO(spGet(searchParams, "start"));

  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [locked, setLocked] = useState(false);

  const [paper, setPaper] = useState<MockPaperV1 | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [answers, setAnswers] = useState<MockAnswerMap>({});
  const [index, setIndex] = useState(0);

  // start time (prefer QS)
  const startedAtISO = useMemo(() => startISOFromQS ?? new Date().toISOString(), [startISOFromQS]);

  // elapsed derived from start
  const [elapsedSec, setElapsedSec] = useState(() => {
    const startMs = new Date(startedAtISO).getTime();
    const nowMs = Date.now();
    return clamp(Math.floor((nowMs - startMs) / 1000), 0, 365 * 24 * 3600);
  });

  const timerRef = useRef<number | null>(null);
  const finishingRef = useRef(false);

  useEffect(() => {
    const p = getPlan();
    setPlan(p);
    setLocked(isMockSlotLocked(p, slot));
  }, [slot]);

  // load paper
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
        setAnswers({});
        setIndex(0);
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

  // timer
  useEffect(() => {
    if (!paper) return;
    if (locked) return;

    setElapsedSec(() => {
      const startMs = new Date(startedAtISO).getTime();
      return clamp(Math.floor((Date.now() - startMs) / 1000), 0, 365 * 24 * 3600);
    });

    timerRef.current = window.setInterval(() => {
      const startMs = new Date(startedAtISO).getTime();
      setElapsedSec(clamp(Math.floor((Date.now() - startMs) / 1000), 0, 365 * 24 * 3600));
    }, 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [paper, locked, startedAtISO]);

  const totalQ = paper?.questions.length ?? 0;
  const q = paper?.questions[index] ?? null;

  const remainingSec = useMemo(() => {
    const limit = paper?.timeLimitSec ?? 0;
    return Math.max(0, limit - elapsedSec);
  }, [paper, elapsedSec]);

  const isLast = useMemo(() => {
    if (!paper) return false;
    return index >= paper.questions.length - 1;
  }, [paper, index]);

  // auto finish on timeout
  useEffect(() => {
    if (!paper) return;
    if (locked) return;
    if (elapsedSec >= paper.timeLimitSec) {
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, paper, locked]);

  function choose(choiceIndex: number) {
    if (!paper || !q) return;
    setAnswers((prev) => ({ ...prev, [q.id]: choiceIndex }));
  }

  function jump(nextIndex: number) {
    if (!paper) return;
    setIndex(clamp(nextIndex, 0, paper.questions.length - 1));
  }

  function finish() {
    if (!paper) return;
    if (finishingRef.current) return;
    finishingRef.current = true;

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const finishedAtISO = new Date().toISOString();

    const result = calcResult({
      paper,
      answers,
      startedAtISO,
      finishedAtISO,
      timeSpentSec: elapsedSec,
    });

    saveMockResult(result);

    router.push(
      `/mock-tests/result?level=${encodeURIComponent(result.level)}&slot=${encodeURIComponent(
        String(result.slot)
      )}&run=${encodeURIComponent(result.id)}`
    );
  }

  // ---- UI ----
  if (locked) {
    return (
      <main style={{ minHeight: "100vh", background: "#000", color: "rgba(255,255,255,0.92)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
          <div style={cardStyle()}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>🔒 This mock is locked</div>
            <div style={{ marginTop: 8, opacity: 0.8, lineHeight: 1.6 }}>
              Free plan includes <b>Slot 1 only</b>. Slots 2–11 require Pro.
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/pricing" style={{ ...pillStyle(), textDecoration: "none" }}>
                Pricing
              </Link>
              <Link href="/mock-tests" style={{ ...pillStyle(), textDecoration: "none" }}>
                ← Back
              </Link>
              <span style={pillStyle()}>{plan === "pro" ? "Pro" : "Free"}</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (loadErr) {
    return (
      <main style={{ minHeight: "100vh", background: "#000", color: "rgba(255,255,255,0.92)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
          <div style={cardStyle()}>
            <div style={{ fontWeight: 950 }}>Failed to load mock data</div>
            <div style={{ marginTop: 8, opacity: 0.8 }}>{loadErr}</div>
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/mock-tests" style={{ ...pillStyle(), textDecoration: "none" }}>
                ← Back
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!paper || !q) {
    return (
      <main style={{ minHeight: "100vh", background: "#000", color: "rgba(255,255,255,0.92)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
          <div style={cardStyle()}>Loading…</div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "rgba(255,255,255,0.92)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 950 }}>{paper.title ?? `Mock · ${level} · Slot ${slot}`}</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              Q {index + 1}/{totalQ} · ⏱ {fmtSec(remainingSec)} left
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={pillStyle()}>{plan === "pro" ? "Pro" : "Free"}</span>
            <span style={pillStyle()}>{Object.keys(answers).length}/{totalQ} answered</span>
            <Link href="/mock-tests" style={{ ...pillStyle(), textDecoration: "none" }}>
              Exit
            </Link>
          </div>
        </div>

        {/* Body */}
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: 12 }}>
          {/* Question */}
          <div style={cardStyle()}>
            <div style={{ fontSize: 18, fontWeight: 950, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{q.prompt}</div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {q.choices.map((c, i) => {
                const selected = answers[q.id] === i;
                return (
                  <button
                    key={i}
                    onClick={() => choose(i)}
                    style={{
                      textAlign: "left",
                      padding: "14px 14px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: selected ? "rgba(120, 90, 255, 0.22)" : "rgba(255,255,255,0.06)",
                      color: "white",
                      fontWeight: 850,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 10,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 950,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(0,0,0,0.25)",
                        opacity: 0.9,
                        flex: "0 0 auto",
                      }}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span style={{ flex: 1 }}>{c}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => jump(index - 1)}
                disabled={index <= 0}
                style={{
                  borderRadius: 14,
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  fontWeight: 950,
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: index <= 0 ? "not-allowed" : "pointer",
                  opacity: index <= 0 ? 0.6 : 1,
                }}
              >
                ← Prev
              </button>

              {!isLast ? (
                <button
                  onClick={() => jump(index + 1)}
                  style={{
                    borderRadius: 14,
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.06)",
                    color: "white",
                    fontWeight: 950,
                    border: "1px solid rgba(255,255,255,0.12)",
                    cursor: "pointer",
                  }}
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={finish}
                  style={{
                    borderRadius: 14,
                    padding: "10px 12px",
                    background: "rgba(120, 90, 255, 0.92)",
                    color: "white",
                    fontWeight: 950,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Finish →
                </button>
              )}
            </div>
          </div>

          {/* Navigator */}
          <div style={cardStyle()}>
            <div style={{ fontWeight: 950 }}>Navigator</div>
            <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12, lineHeight: 1.6 }}>
              Click to jump. Filled = answered.
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
              {paper.questions.map((qq, i) => {
                const done = typeof (answers as any)[qq.id] === "number";
                const active = i === index;

                return (
                  <button
                    key={qq.id}
                    onClick={() => jump(i)}
                    style={{
                      height: 36,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: active
                        ? "rgba(120, 90, 255, 0.28)"
                        : done
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(0,0,0,0.25)",
                      color: "white",
                      fontWeight: 950,
                      cursor: "pointer",
                    }}
                    title={qq.id}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 14, opacity: 0.75, fontSize: 12 }}>
              Time: <b>{fmtSec(elapsedSec)}</b> / Limit: <b>{fmtSec(paper.timeLimitSec)}</b>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}