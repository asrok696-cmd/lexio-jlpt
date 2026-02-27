// app/mock-tests/result/page.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getMockResults } from "@/app/_lib/mockStore";
import type { MockResultV1 } from "@/app/_lib/mockEngine";
import { readMockStore, type MockAttempt } from "@/app/_lib/mockTestsStore";

type Skill = "vocab" | "grammar" | "reading";

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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div
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
      }}
    >
      {children}
    </div>
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

function fmtISODate(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return String(iso ?? "—");
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtMMSS(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function skillLabel(sk: Skill) {
  if (sk === "vocab") return "Vocab";
  if (sk === "grammar") return "Grammar";
  return "Reading";
}

function skillEmoji(sk: Skill) {
  if (sk === "vocab") return "🧠";
  if (sk === "grammar") return "🧩";
  return "📖";
}

export default function MockResultPage() {
  const sp = useSearchParams();

  // NOTE: query is for display / retake links. Actual shown data should come from stored result.
  const qpLevel = (sp.get("level") ?? "N5").toUpperCase();
  const qpSlot = Number(sp.get("slot") ?? "1") || 1;
  const run = sp.get("run");

  const [mounted, setMounted] = useState(false);

  // primary store
  const [resultsV1, setResultsV1] = useState<MockResultV1[]>([]);

  // compat fallback
  const [attemptsCompat, setAttemptsCompat] = useState<MockAttempt[]>([]);
  const [sourceKeyCompat, setSourceKeyCompat] = useState<string | null>(null);

  const [loadErr, setLoadErr] = useState<string | null>(null);

  // ✅ IMPORTANT: re-read when `run` changes (SPA navigation timing fix)
  useEffect(() => {
    setMounted(true);

    try {
      const all = getMockResults();
      setResultsV1(Array.isArray(all) ? all : []);
      setLoadErr(null);
    } catch (e: any) {
      setResultsV1([]);
      setLoadErr(e?.message ?? "Failed to read mock results");
    }

    try {
      const ms = readMockStore();
      setAttemptsCompat(Array.isArray(ms.attempts) ? ms.attempts : []);
      setSourceKeyCompat(ms.sourceKey ?? null);
    } catch {
      setAttemptsCompat([]);
      setSourceKeyCompat(null);
    }
  }, [run]);

  const chosenV1 = useMemo(() => {
    if (!resultsV1.length) return null;
    if (run) {
      const found = resultsV1.find((r) => String(r.id) === String(run));
      if (found) return found;
    }
    return resultsV1[0] ?? null; // newest first
  }, [resultsV1, run]);

  const chosenCompat = useMemo(() => {
    if (!attemptsCompat.length) return null;
    if (!run) return attemptsCompat[0];
    return attemptsCompat.find((a: any) => String(a.id ?? a.run) === String(run)) ?? attemptsCompat[0];
  }, [attemptsCompat, run]);

  const view = useMemo(() => {
    if (chosenV1) {
      const r: any = chosenV1;

      const percent = clampPct(Number(r.percent ?? r.total ?? r.accuracy ?? 0));

      const totalPassPct = clampPct(Number(r?.passRule?.totalPassPct ?? r?.passRule?.passPercent ?? 60));
      const minSkillPct = clampPct(Number(r?.passRule?.minSkillPct ?? r?.passRule?.minSkillPercent ?? 40));

      const bySkillPercent: Record<Skill, number> = {
        vocab: clampPct(r?.bySkillPercent?.vocab ?? r?.bySkillFlat?.vocab ?? r?.bySkill?.vocab?.accuracy ?? 0),
        grammar: clampPct(r?.bySkillPercent?.grammar ?? r?.bySkillFlat?.grammar ?? r?.bySkill?.grammar?.accuracy ?? 0),
        reading: clampPct(r?.bySkillPercent?.reading ?? r?.bySkillFlat?.reading ?? r?.bySkill?.reading?.accuracy ?? 0),
      };

      const computedPass =
        percent >= totalPassPct &&
        (["vocab", "grammar", "reading"] as Skill[]).every((s) => bySkillPercent[s] >= minSkillPct);

      const pass: boolean = typeof r.pass === "boolean" ? r.pass : computedPass;

      const failReasons: string[] = [];
      if (percent < totalPassPct) failReasons.push(`Total ${percent}% is below pass line ${totalPassPct}%`);
      (["vocab", "grammar", "reading"] as Skill[]).forEach((s) => {
        if (bySkillPercent[s] < minSkillPct) {
          failReasons.push(`${skillLabel(s)} ${bySkillPercent[s]}% is below skill min ${minSkillPct}%`);
        }
      });

      return {
        kind: "v1" as const,
        id: r.id,
        title: r.title,
        level: r.level,
        slot: r.slot,
        dateISO: fmtISODate(r.finishedAtISO ?? r.startedAtISO),
        percent,
        correctQ: typeof r.correctQ === "number" ? r.correctQ : null,
        totalQ: typeof r.totalQ === "number" ? r.totalQ : null,
        timeSpentSec: typeof r.timeSpentSec === "number" ? r.timeSpentSec : null,
        bySkill: bySkillPercent,
        pass,
        passPercent: totalPassPct,
        minSkillPercent: minSkillPct,
        failReasons,
      };
    }

    if (chosenCompat) {
      const a: any = chosenCompat;
      const percent = clampPct(Number(a.total ?? a.score ?? 0));
      const passPercent = 60;
      const pass = percent >= passPercent;

      return {
        kind: "compat" as const,
        id: a.id,
        title: `Mock · ${qpLevel} · Slot ${qpSlot}`,
        level: (a.level ?? (qpLevel as any)) as any,
        slot: a.slot ?? qpSlot,
        dateISO: a.dateISO ?? "—",
        percent,
        correctQ: null as number | null,
        totalQ: null as number | null,
        timeSpentSec: a.timeSec ?? null,
        bySkill: {
          vocab: clampPct(a?.bySkill?.vocab ?? 0),
          grammar: clampPct(a?.bySkill?.grammar ?? 0),
          reading: clampPct(a?.bySkill?.reading ?? 0),
        },
        pass,
        passPercent,
        minSkillPercent: 0,
        failReasons: pass ? [] : [`Total ${percent}% is below pass line ${passPercent}%`],
      };
    }

    return null;
  }, [chosenV1, chosenCompat, qpLevel, qpSlot]);

  const headerSub = useMemo(() => {
    const date = view?.dateISO ?? "—";
    const lvl = view?.level ?? qpLevel;
    const sl = view?.slot ?? qpSlot;
    return `Mock · ${String(lvl)} · Slot ${String(sl)} · ${date}`;
  }, [view, qpLevel, qpSlot]);

  if (!mounted) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>Loading…</SoftCard>
        </div>
      </main>
    );
  }

  const attemptsCount = resultsV1.length || attemptsCompat.length || 0;

  // ✅ PASS/FAIL color hint
  const glow = view?.pass
    ? "0 0 0 1px rgba(60,255,140,0.20) inset, 0 0 35px rgba(60,255,140,0.10)"
    : "0 0 0 1px rgba(255,80,80,0.18) inset, 0 0 35px rgba(255,80,80,0.10)";

  return (
    <main style={pageWrap}>
      <div style={container}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 950, letterSpacing: -0.5 }}>Mock Result</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>{headerSub}</div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>attempts {attemptsCount}</Pill>
              {view ? (
                <Pill>
                  {view.pass ? "✅ PASS" : "❌ FAIL"} · {view.percent}% (line {view.passPercent}%)
                  {view.kind === "v1" ? ` · skill min ${view.minSkillPercent}%` : ""}
                </Pill>
              ) : (
                <Pill>—</Pill>
              )}
              {sourceKeyCompat ? <Pill>compatKey {sourceKeyCompat}</Pill> : null}
              {view ? <Pill>run {String(view.id).slice(0, 12)}…</Pill> : null}
              {run && view && String(run) !== String(view.id) ? <Pill>run not found → showing latest</Pill> : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <NavBtn href="/mock-tests">← Mock Tests</NavBtn>
            <NavBtn href="/reports">Reports</NavBtn>
          </div>
        </div>

        {/* Error / Empty */}
        {loadErr ? (
          <div style={{ marginTop: 12 }}>
            <SoftCard>
              <div style={{ fontWeight: 950, fontSize: 18 }}>Couldn’t read results</div>
              <div style={{ marginTop: 8, opacity: 0.8, lineHeight: 1.7 }}>{loadErr}</div>
              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <NavBtn href="/mock-tests">Back to Mock Tests</NavBtn>
              </div>
            </SoftCard>
          </div>
        ) : null}

        {!loadErr && !view ? (
          <div style={{ marginTop: 12 }}>
            <SoftCard>
              <div style={{ fontWeight: 950, fontSize: 18 }}>No results yet</div>
              <div style={{ marginTop: 8, opacity: 0.8, lineHeight: 1.7 }}>
                まだ模試結果がありません。Mock Tests から模試を受けると、ここにスコアが表示されます。
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <NavBtn href="/mock-tests">Take a mock →</NavBtn>
              </div>
            </SoftCard>
          </div>
        ) : null}

        {/* Main */}
        {!loadErr && view ? (
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            {/* Summary */}
            <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.05)", padding: 16, boxShadow: glow }}>
              <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Summary</div>
              <div style={{ marginTop: 6, fontSize: 28, fontWeight: 950 }}>{view.pass ? "PASS ✅" : "FAIL ❌"}</div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <div
                  style={{
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.18)",
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 950 }}>Score</div>
                  <div style={{ marginTop: 4, fontSize: 44, fontWeight: 950 }}>{view.percent}%</div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                    Pass line: {view.passPercent}%
                    {view.kind === "v1" ? ` · Skill min: ${view.minSkillPercent}%` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {view.timeSpentSec != null ? <Pill>time {fmtMMSS(view.timeSpentSec)}</Pill> : null}
                  {view.totalQ != null && view.correctQ != null ? <Pill>correct {view.correctQ}/{view.totalQ}</Pill> : null}
                </div>

                {/* ✅ FAIL reasons */}
                {!view.pass ? (
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.78, lineHeight: 1.65 }}>
                    <div style={{ fontWeight: 950, marginBottom: 6 }}>Why failed</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {view.failReasons.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.65, lineHeight: 1.6 }}>
                    ✅ Total + skill minimum cleared.
                  </div>
                )}

                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.65, lineHeight: 1.6 }}>
                  Tip: 今は localStorage 保存（開発中）。ブラウザデータ削除で結果も消える。
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <SoftCard>
              <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Breakdown</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>By skill</div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {(["vocab", "grammar", "reading"] as const).map((sk) => (
                  <div
                    key={sk}
                    style={{
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(0,0,0,0.18)",
                      padding: 14,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 14,
                          display: "grid",
                          placeItems: "center",
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(0,0,0,0.22)",
                          fontSize: 16,
                        }}
                      >
                        {skillEmoji(sk)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 950 }}>{skillLabel(sk)}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          {view.kind === "v1" ? `min ${view.minSkillPercent}%` : "Accuracy"}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: 22, fontWeight: 950 }}>{(view.bySkill as any)[sk]}%</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65, lineHeight: 1.6 }}>
                ※ v1: bySkillPercent / bySkillFlat / bySkill.accuracy の順で表示。compat: 互換ストア値。
              </div>
            </SoftCard>

            {/* Next actions */}
            <SoftCard>
              <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Next</div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>What to do</div>

              <div style={{ marginTop: 12, fontSize: 13, opacity: 0.86, lineHeight: 1.7 }}>
                • すぐ次の模試を受ける → <b>Mock Tests</b>
                <br />
                • 推移を見たい → <b>Reports</b>
                <br />
                • 弱点で復習したい → <b>Practice</b>（連携は次のステップで実装）
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <NavBtn href="/mock-tests">Take another</NavBtn>
                <NavBtn href="/reports">See analytics</NavBtn>
                <NavBtn
                  href={`/mock-tests/session?level=${encodeURIComponent(String(view.level ?? qpLevel))}&slot=${encodeURIComponent(
                    String(view.slot ?? qpSlot)
                  )}`}
                >
                  Retake same
                </NavBtn>
              </div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65, lineHeight: 1.6 }}>
                run が見つからない場合でも “最新結果” を表示する仕様。
              </div>
            </SoftCard>
          </div>
        ) : null}
      </div>
    </main>
  );
}