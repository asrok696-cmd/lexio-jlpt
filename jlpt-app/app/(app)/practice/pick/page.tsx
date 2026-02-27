// app/(app)/practice/pick/page.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Legacy route compatibility page.
 *
 * B導線では /practice/pick は不要になったため、
 * 既存リンクやブックマークから来ても /practice/session に寄せる。
 *
 * - /practice/pick?day=1
 *   -> /practice/session?day=1
 *
 * 将来的に skill / set を pick に付けて来るケースがあっても
 * そのまま session 側へ引き継げるようにしておく。
 */
export default function PracticePickPage() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const day = Math.max(1, Number(sp.get("day") ?? "1") || 1);

    // 互換のため拾う（通常は不要だが、古い導線を壊さない）
    const skill = sp.get("skill");
    const set = sp.get("set");
    const date = sp.get("date");

    const qs = new URLSearchParams();
    qs.set("day", String(day));
    if (skill) qs.set("skill", skill);
    if (set) qs.set("set", set);
    if (date) qs.set("date", date);

    // B導線のハブに集約
    router.replace(`/practice/session?${qs.toString()}`);
  }, [router, sp]);

  // 一瞬見える場合の軽いプレースホルダ（黒背景に合わせる）
  return (
    <main
      style={{
        minHeight: "100vh",
        color: "rgba(255,255,255,0.92)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.05)",
          padding: 18,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.25) inset",
        }}
      >
        <div style={{ fontWeight: 950, fontSize: 18 }}>Redirecting…</div>
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.78 }}>
          Practice Set picker は新しい導線に統合されました。Day Hub に移動しています。
        </div>
      </div>
    </main>
  );
}