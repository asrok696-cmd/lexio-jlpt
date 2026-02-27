// app/(app)/reports/page.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { readJSON, todayISO } from "@/app/_lib/roadmap";
import { PRACTICE_LOG_KEY } from "@/app/_lib/carryover";
import { WEEKLY_CHECK_KEY, type WeeklyCheckStore } from "@/app/_lib/weeklyCheck";

// ✅ Mock store (compat reader)
import { readMockStore, type MockAttempt } from "@/app/_lib/mockTestsStore";

// -----------------------------
// Local compat types
// -----------------------------
type Skill = "vocab" | "grammar" | "reading";

/**
 * roadmap.ts から PracticeEvent が export されていない環境向けに
 * reports側でローカル定義（loose / compat-first）
 */
type PracticeEvent = {
  at?: string;
  dateISO?: string;
  date?: string; // old compat
  skill?: Skill | string;
  qid?: string;
  correct?: boolean;
  minutes?: number;
  mins?: number; // old compat
  meta?: {
    skill?: Skill | string;
    [k: string]: any;
  };
  [k: string]: any;
};

// -----------------------------
// UI atoms (match Dashboard / Practice vibe)
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

function fmtISOShort(iso: string) {
  const s = String(iso ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(5);
  return s;
}

function sumMinutes(events: PracticeEvent[]) {
  return Math.round(events.reduce((acc, e) => acc + Number(e?.minutes ?? e?.mins ?? 0), 0));
}

/** ✅ FIX: Pie label text turns black by default.
 *  We render our own label so the fill is always white.
 */
function donutLabelWhite(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  const p = Math.round((percent ?? 0) * 100);

  // 0%は表示しない（見た目が綺麗）
  if (!p) return null;

  const RAD = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.72;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);

  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fill="rgba(255,255,255,0.92)"
      style={{ fontSize: 12, fontWeight: 900 }}
    >
      {p}%
    </text>
  );
}

// -----------------------------
// Page
// -----------------------------
export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);

  const [practiceLog, setPracticeLog] = useState<PracticeEvent[]>([]);
  const [weeklyStore, setWeeklyStore] = useState<WeeklyCheckStore | null>(null);

  // ✅ Mock
  const [mockAttempts, setMockAttempts] = useState<MockAttempt[]>([]);
  const [mockSourceKey, setMockSourceKey] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    const log = readJSON<PracticeEvent[]>(PRACTICE_LOG_KEY) ?? [];
    setPracticeLog(Array.isArray(log) ? log : []);

    const wc = readJSON<WeeklyCheckStore>(WEEKLY_CHECK_KEY);
    setWeeklyStore(wc ?? null);

    // ✅ read mock store (compat)
    try {
      const ms = readMockStore();
      setMockAttempts(ms.attempts ?? []);
      setMockSourceKey(ms.sourceKey ?? null);
    } catch {
      setMockAttempts([]);
      setMockSourceKey(null);
    }
  }, []);

  // ---------- build last 7 days range ----------
  const today = todayISO();
  const last7 = useMemo(() => {
    const base = new Date(today);
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      days.push(`${yyyy}-${mm}-${dd}`);
    }
    return days;
  }, [today]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, PracticeEvent[]>();
    for (const e of practiceLog) {
      const dateISO = String(e?.dateISO ?? e?.date ?? "");
      if (!dateISO) continue;
      if (!m.has(dateISO)) m.set(dateISO, []);
      m.get(dateISO)!.push(e);
    }
    return m;
  }, [practiceLog]);

  const weeklyLineData = useMemo(() => {
    return last7.map((d) => {
      const ev = eventsByDate.get(d) ?? [];
      return { date: fmtISOShort(d), minutes: sumMinutes(ev) };
    });
  }, [last7, eventsByDate]);

  const totalMinutes7 = useMemo(
    () => weeklyLineData.reduce((a, r) => a + (r.minutes ?? 0), 0),
    [weeklyLineData]
  );

  const skillBarData = useMemo(() => {
    const sum: Record<Skill, number> = { vocab: 0, grammar: 0, reading: 0 };
    for (const d of last7) {
      const evs = eventsByDate.get(d) ?? [];
      for (const e of evs) {
        const sk = String(e?.skill ?? e?.meta?.skill ?? "");
        const min = Number(e?.minutes ?? e?.mins ?? 0) || 0;
        if (sk === "vocab" || sk === "grammar" || sk === "reading") sum[sk] += min;
      }
    }
    return [
      { name: "vocab", minutes: sum.vocab },
      { name: "grammar", minutes: sum.grammar },
      { name: "reading", minutes: sum.reading },
    ];
  }, [last7, eventsByDate]);

  const topSkill = useMemo(() => {
    const sorted = [...skillBarData].sort((a, b) => (b.minutes ?? 0) - (a.minutes ?? 0));
    return sorted[0]?.name ?? "—";
  }, [skillBarData]);

  const pieData = useMemo(() => skillBarData.map((x) => ({ name: x.name, value: x.minutes })), [skillBarData]);

  // ---------- Weekly Check latest ----------
  const latestWeekly = useMemo(() => {
    const h = (weeklyStore as any)?.history ?? [];
    if (!Array.isArray(h) || !h.length) return null;
    return h[0];
  }, [weeklyStore]);

  const weeklyScoresBar = useMemo(() => {
    if (!latestWeekly?.bySkill) return [];
    return (["vocab", "grammar", "reading"] as const).map((sk) => ({
      name: sk,
      correct: Number(latestWeekly.bySkill?.[sk]?.correct ?? 0),
    }));
  }, [latestWeekly]);

  // ---------- Mock Tests ----------
  const latestMock = useMemo(() => (mockAttempts?.length ? mockAttempts[0] : null), [mockAttempts]);

  const mockBySkillBar = useMemo(() => {
    if (!latestMock) return [];
    return (["vocab", "grammar", "reading"] as const).map((sk) => ({
      name: sk,
      score: Number(latestMock.bySkill?.[sk] ?? 0),
    }));
  }, [latestMock]);

  const mockDelta = useMemo(() => {
    if (!mockAttempts || mockAttempts.length < 2) return null;
    const a = mockAttempts[0];
    const b = mockAttempts[1];
    return Number(a.total ?? 0) - Number(b.total ?? 0);
  }, [mockAttempts]);

  const mockPie = useMemo(() => {
    if (!latestMock) return [];
    return (["vocab", "grammar", "reading"] as const).map((sk) => ({
      name: sk,
      value: Number(latestMock.bySkill?.[sk] ?? 0),
    }));
  }, [latestMock]);

  const recentMockList = useMemo(() => {
    const xs = Array.isArray(mockAttempts) ? mockAttempts : [];
    return xs.slice(0, 6);
  }, [mockAttempts]);

  // chart common
  const chartFrame: React.CSSProperties = {
    width: "100%",
    height: 240,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.18)",
    padding: 10,
    boxSizing: "border-box",
  };

  const grid3: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 12,
    marginTop: 12,
  };

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 44, fontWeight: 950, letterSpacing: -0.5 }}>Reports</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              Performance · Weekly Check · Analytics
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <NavBtn href="/dashboard">← Dashboard</NavBtn>
            <NavBtn href="/practice">Practice</NavBtn>
            <NavBtn href="/practice?mode=weekly-check">Weekly Check</NavBtn>
            <NavBtn href="/mock-tests">Mock Tests</NavBtn>
          </div>
        </div>

        {/* Top row: summary + trend + focus */}
        <div style={grid3}>
          <SoftCard>
            <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>This week</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Study summary</div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>
                range {last7[0].slice(5)}/{last7[6].slice(5)}
              </Pill>
              <Pill>log {practiceLog.length}</Pill>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div style={{ ...chartFrame, height: "auto", padding: 14 }}>
                <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 950 }}>Total minutes</div>
                <div style={{ marginTop: 4, fontSize: 28, fontWeight: 950 }}>{totalMinutes7}</div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                  Last 7 days (from practice log)
                </div>
              </div>

              <div style={{ ...chartFrame, height: "auto", padding: 14 }}>
                <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 950 }}>Top skill</div>
                <div style={{ marginTop: 4, fontSize: 28, fontWeight: 950 }}>{topSkill}</div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                  Based on minutes distribution
                </div>
              </div>

              <div style={{ ...chartFrame, height: "auto", padding: 14 }}>
                <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 950 }}>Latest Weekly Check</div>
                <div style={{ marginTop: 6, fontSize: 14, fontWeight: 950 }}>
                  {latestWeekly ? latestWeekly.weekId : "—"}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                  History: {Array.isArray((weeklyStore as any)?.history) ? (weeklyStore as any).history.length : 0}
                </div>
              </div>

              {/* ✅ Latest Mock summary (small, non-breaking) */}
              <div style={{ ...chartFrame, height: "auto", padding: 14 }}>
                <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 950 }}>Latest Mock Test</div>
                {latestMock ? (
                  <>
                    <div
                      style={{
                        marginTop: 6,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <Pill>date {latestMock.dateISO}</Pill>
                      {typeof latestMock.total === "number" ? <Pill>total {latestMock.total}</Pill> : null}
                      {mockDelta != null ? (
                        <Pill>{mockDelta >= 0 ? `+${mockDelta}` : `${mockDelta}`}</Pill>
                      ) : (
                        <Pill>Δ —</Pill>
                      )}
                      {mockSourceKey ? <Pill>key {mockSourceKey}</Pill> : <Pill>key —</Pill>}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                      V {latestMock.bySkill.vocab} · G {latestMock.bySkill.grammar} · R {latestMock.bySkill.reading}
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                    No mock attempts found yet. Take a mock test to see results here.
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65, lineHeight: 1.6 }}>
              Tip: Weekly charts use <b>{PRACTICE_LOG_KEY}</b>. Weekly Check uses <b>{WEEKLY_CHECK_KEY}</b>. Mock
              uses known mock keys (compat).
            </div>
          </SoftCard>

          <SoftCard>
            <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Weekly study time</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Trend</div>

            <div style={{ marginTop: 12, ...chartFrame }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyLineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.55)" />
                  <YAxis stroke="rgba(255,255,255,0.55)" />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(0,0,0,0.85)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      color: "white",
                      fontWeight: 900,
                    }}
                    itemStyle={{ color: "white" }}
                    labelStyle={{ color: "white" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="minutes"
                    stroke="rgba(120, 90, 255, 0.92)"
                    strokeWidth={3}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Line = total minutes per day (last 7 days).
            </div>

            {/* ✅ Mock Tests: remove line chart, show recent scores as text */}
            <div style={{ marginTop: 16, fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Mock Tests</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Recent attempts</div>

            <div style={{ marginTop: 12, ...chartFrame, height: "auto", padding: 14 }}>
              {recentMockList.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {recentMockList.map((a) => {
                    const total = Number(a.total ?? 0);
                    const v = Number(a.bySkill?.vocab ?? 0);
                    const g = Number(a.bySkill?.grammar ?? 0);
                    const r = Number(a.bySkill?.reading ?? 0);

                    const pass =
                      typeof (a.meta as any)?.pass === "boolean" ? (a.meta as any).pass : null;

                    return (
                      <div
                        key={a.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "center",
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(0,0,0,0.18)",
                          padding: 12,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <div style={{ fontWeight: 950 }}>{a.dateISO ?? "—"}</div>
                            {a.level ? (
                              <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>
                                {String(a.level)}
                                {a.slot ? ` · Slot ${a.slot}` : ""}
                              </div>
                            ) : null}
                            {pass != null ? (
                              <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.9 }}>
                                {pass ? "✅ PASS" : "❌ FAIL"}
                              </div>
                            ) : null}
                          </div>

                          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                            V {v} · G {g} · R {r}
                            {a.timeSec != null
                              ? ` · time ${Math.round((Number(a.timeSec) || 0) / 60)}m`
                              : ""}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 8,
                            flex: "0 0 auto",
                          }}
                        >
                          <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -0.3 }}>
                            {Math.max(0, Math.min(100, Math.round(total)))}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ opacity: 0.7, fontSize: 12 }}>No mock attempts yet.</div>
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Latest mock attempts (up to 6).
            </div>
          </SoftCard>

          <SoftCard>
            <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Study time by skill</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Focus</div>

            <div style={{ marginTop: 12, ...chartFrame }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skillBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.55)" />
                  <YAxis stroke="rgba(255,255,255,0.55)" />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(0,0,0,0.85)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      color: "white",
                      fontWeight: 900,
                    }}
                    itemStyle={{ color: "white" }}
                    labelStyle={{ color: "white" }}
                  />
                  <Bar dataKey="minutes" fill="rgba(120, 90, 255, 0.70)" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Bar = minutes by skill (last 7 days).
            </div>

            {/* latest mock by-skill bar */}
            <div style={{ marginTop: 16, fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Mock Tests</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Latest breakdown</div>

            <div style={{ marginTop: 12, ...chartFrame }}>
              {mockBySkillBar.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockBySkillBar}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.55)" />
                    <YAxis stroke="rgba(255,255,255,0.55)" />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(0,0,0,0.85)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 12,
                        color: "white",
                        fontWeight: 900,
                      }}
                      itemStyle={{ color: "white" }}
                      labelStyle={{ color: "white" }}
                    />
                    <Bar dataKey="score" fill="rgba(120, 90, 255, 0.70)" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    opacity: 0.7,
                    fontSize: 12,
                  }}
                >
                  No mock attempts yet.
                </div>
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Bar = latest mock score by skill.
            </div>
          </SoftCard>
        </div>

        {/* Second row: distribution + weekly check + notes */}
        <div style={grid3}>
          <SoftCard>
            <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Distribution</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Skill mix</div>

            <div style={{ marginTop: 12, ...chartFrame }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    labelLine={false}
                    label={donutLabelWhite}
                  >
                    {pieData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          i === 0
                            ? "rgba(120,90,255,0.9)"
                            : i === 1
                            ? "rgba(120,90,255,0.65)"
                            : "rgba(120,90,255,0.45)"
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(0,0,0,0.85)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 12,
                      color: "white",
                      fontWeight: 900,
                    }}
                    itemStyle={{ color: "white" }}
                    labelStyle={{ color: "white" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Donut = minutes distribution (last 7 days).
            </div>

            {/* mock skill share donut */}
            <div style={{ marginTop: 16, fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Mock Tests</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Skill share</div>

            <div style={{ marginTop: 12, ...chartFrame }}>
              {mockPie.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mockPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      labelLine={false}
                      label={donutLabelWhite}
                    >
                      {mockPie.map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            i === 0
                              ? "rgba(120,90,255,0.9)"
                              : i === 1
                              ? "rgba(120,90,255,0.65)"
                              : "rgba(120,90,255,0.45)"
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgba(0,0,0,0.85)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 12,
                        color: "white",
                        fontWeight: 900,
                      }}
                      itemStyle={{ color: "white" }}
                      labelStyle={{ color: "white" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    opacity: 0.7,
                    fontSize: 12,
                  }}
                >
                  No mock attempts yet.
                </div>
              )}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Donut = latest mock by-skill distribution.
            </div>
          </SoftCard>

          <SoftCard>
            <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Weekly Check</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Latest scores</div>

            <div style={{ marginTop: 12, ...chartFrame }}>
              {weeklyScoresBar.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyScoresBar}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.55)" />
                    <YAxis domain={[0, 10]} stroke="rgba(255,255,255,0.55)" />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(0,0,0,0.85)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 12,
                        color: "white",
                        fontWeight: 900,
                      }}
                      itemStyle={{ color: "white" }}
                      labelStyle={{ color: "white" }}
                    />
                    <Bar dataKey="correct" fill="rgba(120, 90, 255, 0.70)" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    opacity: 0.7,
                    fontSize: 12,
                  }}
                >
                  No Weekly Check result yet.
                </div>
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Bar = correct answers /10 for latest Weekly Check.
            </div>
          </SoftCard>

          <SoftCard>
            <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Notes</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Readable insights</div>

            <div
              style={{
                marginTop: 12,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.18)",
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 950 }}>This week</div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.86, lineHeight: 1.7 }}>
                • Total: <b>{totalMinutes7}</b> minutes
                <br />
                • Most time spent on: <b>{topSkill}</b>
                <br />
                • Weekly Check history:{" "}
                <b>{Array.isArray((weeklyStore as any)?.history) ? (weeklyStore as any).history.length : 0}</b>{" "}
                record(s)
              </div>

              <div style={{ marginTop: 14, fontWeight: 950 }}>Mock Tests</div>
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.86, lineHeight: 1.7 }}>
                {latestMock ? (
                  <>
                    • Latest total: <b>{latestMock.total}</b> ({latestMock.dateISO})
                    <br />
                    • Delta vs previous:{" "}
                    <b>{mockDelta == null ? "—" : mockDelta >= 0 ? `+${mockDelta}` : `${mockDelta}`}</b>
                    <br />
                    • Breakdown: V <b>{latestMock.bySkill.vocab}</b> / G <b>{latestMock.bySkill.grammar}</b> / R{" "}
                    <b>{latestMock.bySkill.reading}</b>
                  </>
                ) : (
                  <>• No mock attempts found yet.</>
                )}
              </div>

              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
                If mock charts are empty, confirm that your Mock Tests page writes results to localStorage.
                (This page can read several common keys automatically.)
              </div>
            </div>
          </SoftCard>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 16, fontSize: 12, opacity: 0.65 }}>
          keys: <b>{PRACTICE_LOG_KEY}</b> / <b>{WEEKLY_CHECK_KEY}</b>
          {mockSourceKey ? (
            <>
              {" "}
              / mockKey: <b>{mockSourceKey}</b>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}