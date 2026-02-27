"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { devLogout } from "../_lib/auth";
import { clearDiagnosticDone } from "../_lib/onboarding";

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
      }}
    >
      {children}
    </div>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        color: "white",
        fontWeight: 950,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  return (
    <main style={pageWrap}>
      <div style={container}>
        <div style={{ fontSize: 28, fontWeight: 950 }}>Dashboard</div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
          初回診断済みユーザーの着地点（ここから Practice / Weekly Check / Reports に繋ぐ）
        </div>

        <div style={{ marginTop: 14 }}>
          <SoftCard>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Dev controls</div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <Btn
                onClick={() => {
                  // 初回やり直し
                  clearDiagnosticDone();
                  router.replace("/start");
                }}
              >
                Reset Diagnostic Flag →
              </Btn>

              <Btn
                onClick={() => {
                  // ログアウト
                  devLogout();
                  router.replace("/start");
                }}
              >
                Logout →
              </Btn>
            </div>
          </SoftCard>
        </div>
      </div>
    </main>
  );
}