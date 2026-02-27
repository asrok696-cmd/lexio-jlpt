// app/(app)/mock-tests/result/ResultClient.tsx
"use client";

import React from "react";
import { useSearchParams } from "next/navigation";

export default function ResultClient() {
  const sp = useSearchParams();

  // ここに元々 page.tsx に書いてたUI/ロジックを移す
  const sessionId = sp.get("session") ?? "";

  return (
    <main style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ fontSize: 28, fontWeight: 900 }}>Mock Test Result</div>
      <div style={{ marginTop: 10, opacity: 0.8 }}>session: {sessionId}</div>
    </main>
  );
}