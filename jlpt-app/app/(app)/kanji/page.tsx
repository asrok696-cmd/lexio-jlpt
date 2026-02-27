// app/(app)/kanji/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type JLPT = "N5" | "N4" | "N3" | "N2" | "N1";

type KanjiEntry = {
  char: string;
  onyomi: string[];
  kunyomi: string[];
  romajiOn: string[];
  romajiKun: string[];
  meaning: string;
};

type KanjiJSON = {
  level: JLPT;
  kanji: KanjiEntry[];
};

type KanjiCard = {
  id: string;
  kanji: string;
  onyomiKana: string[];
  onyomiRoma: string[];
  kunyomiKana: string[];
  kunyomiRoma: string[];
  meaningEn: string;
};

const LEVELS: JLPT[] = ["N5", "N4", "N3", "N2", "N1"];

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 18% 18%, rgba(120,90,255,0.16) 0%, rgba(0,0,0,0.0) 35%), radial-gradient(circle at 70% 25%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.0) 40%), #050507",
  color: "rgba(255,255,255,0.92)",
};

function cardShell(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    padding: 16,
    boxShadow: "0 0 0 1px rgba(0,0,0,0.25) inset",
    boxSizing: "border-box",
    minWidth: 0,
  };
}

function pill(active?: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(120,90,255,0.22)" : "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.90)",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
    userSelect: "none",
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(120, 90, 255, 0.92)",
    color: "white",
    fontWeight: 950,
    border: "none",
    cursor: "pointer",
  };
}

function btnGhost(): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: "pointer",
  };
}

function normalizeDeck(data: KanjiJSON): KanjiCard[] {
  const list = Array.isArray(data?.kanji) ? data.kanji : [];
  return list.map((k, idx) => ({
    id: `${data.level}-${k.char}-${idx}`,
    kanji: k.char,
    onyomiKana: Array.isArray(k.onyomi) ? k.onyomi : [],
    onyomiRoma: Array.isArray(k.romajiOn) ? k.romajiOn : [],
    kunyomiKana: Array.isArray(k.kunyomi) ? k.kunyomi : [],
    kunyomiRoma: Array.isArray(k.romajiKun) ? k.romajiKun : [],
    meaningEn: String(k.meaning ?? ""),
  }));
}

export default function KanjiPage() {
  const [level, setLevel] = useState<JLPT>("N5");
  const [deck, setDeck] = useState<KanjiCard[]>([]);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(80);

  useEffect(() => {
    let canceled = false;

    async function load() {
      try {
        const res = await fetch(`/kanji-data/${level}.json`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        const json = (await res.json()) as KanjiJSON;
        if (canceled) return;

        const normalized = normalizeDeck(json);
        setDeck(normalized);
        setFlipped({});
      } catch {
        if (canceled) return;
        setDeck([]);
        setFlipped({});
      }
    }

    load();
    return () => {
      canceled = true;
    };
  }, [level]);

  function toggle(id: string) {
    setFlipped((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function shuffle() {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setFlipped({});
  }

  function flipAll() {
    const next: Record<string, boolean> = {};
    for (const c of deck) next[c.id] = true;
    setFlipped(next);
  }

  function reset() {
    setFlipped({});
    setQuery("");
  }

  const filteredDeck = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? deck.filter((c) => {
          const blob = [
            c.kanji,
            c.meaningEn,
            c.onyomiKana.join(" "),
            c.kunyomiKana.join(" "),
            c.onyomiRoma.join(" "),
            c.kunyomiRoma.join(" "),
          ]
            .join(" ")
            .toLowerCase();
          return blob.includes(q);
        })
      : deck;

    return list.slice(0, Math.max(1, Math.min(300, Number(limit) || 80)));
  }, [deck, query, limit]);

  return (
    <main style={pageWrap}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 950, letterSpacing: -0.5 }}>Kanji</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              Flashcards · flip to reveal readings & meaning
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ ...pill(false), cursor: "default" }}>showing {filteredDeck.length}</div>
          </div>
        </div>

        {/* Controls row */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 12 }}>
          {/* Left: level + actions */}
          <div style={cardShell()}>
            <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Choose level</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>JLPT</div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {LEVELS.map((lv) => (
                <button key={lv} onClick={() => setLevel(lv)} style={pill(lv === level)}>
                  {lv}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={shuffle} style={btnPrimary()}>
                Shuffle
              </button>
              <button onClick={flipAll} style={btnGhost()}>
                Flip all
              </button>
              <button onClick={reset} style={btnGhost()}>
                Reset
              </button>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
              Tip: Click a card to flip. Use search to find by kana/romaji/meaning.
            </div>
          </div>

          {/* Right: search + limit */}
          <div style={cardShell()}>
            <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Deck</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Cards</div>

            <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search: 日 / nichi / ひ / day ..."
                style={{
                  flex: 1,
                  minWidth: 260,
                  borderRadius: 12,
                  padding: "10px 12px",
                  background: "rgba(0,0,0,0.22)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "white",
                  outline: "none",
                  fontWeight: 800,
                }}
              />

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 950 }}>Limit</div>
                <input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  style={{
                    width: 120,
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "rgba(0,0,0,0.22)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "white",
                    outline: "none",
                    fontWeight: 900,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Cards grid */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {filteredDeck.map((c) => {
            const isFlip = !!flipped[c.id];

            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                style={{
                  border: "none",
                  padding: 0,
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ perspective: 1000 }}>
                  <div
                    style={{
                      position: "relative",
                      height: 200,
                      borderRadius: 18,
                      transformStyle: "preserve-3d",
                      transition: "transform 0.5s ease",
                      transform: isFlip ? "rotateY(180deg)" : "rotateY(0deg)",
                    }}
                  >
                    {/* FRONT */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 18,
                        background: "linear-gradient(135deg, #1f1f2e, #0f0f17)",
                        color: "white",
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.28) inset",
                        display: "grid",
                        placeItems: "center",
                        backfaceVisibility: "hidden",
                      }}
                    >
                      <div style={{ fontSize: 64, fontWeight: 950, letterSpacing: -1 }}>{c.kanji}</div>
                      <div style={{ position: "absolute", left: 14, bottom: 12, fontSize: 11, opacity: 0.55 }}>
                        tap to flip
                      </div>
                    </div>

                    {/* BACK */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 18,
                        background: "linear-gradient(135deg, #2a2150, #14142b)",
                        color: "white",
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.28) inset",
                        padding: 16,
                        transform: "rotateY(180deg)",
                        backfaceVisibility: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                        <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -0.5 }}>{c.kanji}</div>
                        <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>{c.meaningEn}</div>
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.55 }}>
                        <div style={{ fontWeight: 950, opacity: 0.85, marginBottom: 2 }}>Readings</div>

                        <div>
                          <span style={{ fontWeight: 950 }}>On-yomi</span>
                          <span style={{ opacity: 0.85 }}> · </span>
                          <span>{c.onyomiKana?.length ? c.onyomiKana.join("・") : "—"}</span>
                          <span style={{ opacity: 0.85 }}> · </span>
                          <span style={{ opacity: 0.92 }}>{c.onyomiRoma?.length ? c.onyomiRoma.join(" · ") : "—"}</span>
                        </div>

                        <div style={{ marginTop: 4 }}>
                          <span style={{ fontWeight: 950 }}>Kun-yomi</span>
                          <span style={{ opacity: 0.85 }}> · </span>
                          <span>{c.kunyomiKana?.length ? c.kunyomiKana.join("・") : "—"}</span>
                          <span style={{ opacity: 0.85 }}> · </span>
                          <span style={{ opacity: 0.92 }}>{c.kunyomiRoma?.length ? c.kunyomiRoma.join(" · ") : "—"}</span>
                        </div>
                      </div>

                      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontSize: 11, opacity: 0.55 }}>tap to close</div>
                        <div style={{ fontSize: 11, opacity: 0.55 }}>Kanji deck</div>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}