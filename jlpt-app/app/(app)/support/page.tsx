// app/(app)/support/page.tsx
"use client";

import Link from "next/link";
import React from "react";

const CONTACT_EMAIL = "lexio7jlpt@gmail.com";

// -----------------------------
// Mock-tests-like UI atoms
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
        color: "rgba(255,255,255,0.88)",
        whiteSpace: "nowrap",
        userSelect: "none",
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

const frame: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
  padding: 14,
  boxSizing: "border-box",
};

// -----------------------------
// Support page
// -----------------------------
function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "14px 0" }} />;
}

function FeatureRow({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ width: 18 }}>•</div>
      <div style={{ opacity: 0.88, lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

function InfoCard({
  title,
  pill,
  children,
}: {
  title: string;
  pill?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(0,0,0,0.18)",
        padding: 14,
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 950 }}>{title}</div>
        {pill ? <Pill>{pill}</Pill> : null}
      </div>
      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.82, lineHeight: 1.65 }}>{children}</div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <main style={pageWrap}>
      <div style={container}>
        {/* Header (match mock-tests layout) */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 950, letterSpacing: -0.5 }}>Support</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>Contact · Refund policy · Troubleshooting</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <NavBtn href="/dashboard">Dashboard</NavBtn>
            <NavBtn href="/practice">Practice</NavBtn>
            <NavBtn href="/mock-tests">Mock Tests</NavBtn>
            <NavBtn href="/reports">Reports</NavBtn>
          </div>
        </div>

        {/* Contact */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Contact</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Get help</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                  Bugs, billing, or feedback — email us.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>⏱ Reply: 24–72h</Pill>
                <Pill>📎 Attach screenshot</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, ...frame }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950 }}>Email</div>
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.82, lineHeight: 1.6 }}>
                    Include device / browser / what you clicked.
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <a
                      href={`mailto:${CONTACT_EMAIL}`}
                      style={{
                        textDecoration: "none",
                        borderRadius: 14,
                        padding: "12px 14px",
                        background: "white",
                        color: "black",
                        fontWeight: 950,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      ✉️ {CONTACT_EMAIL}
                    </a>
                    <div style={{ fontSize: 12, opacity: 0.65 }}>Fastest: add URL + steps + screenshot</div>
                  </div>
                </div>

                <InfoCard title="Good to include" pill="checklist">
                  <div style={{ display: "grid", gap: 8 }}>
                    <FeatureRow text="App page URL (e.g. /practice)" />
                    <FeatureRow text="Steps to reproduce" />
                    <FeatureRow text="Screenshot / screen recording" />
                    <FeatureRow text="Console error (if any)" />
                  </div>
                </InfoCard>
              </div>
            </div>
          </SoftCard>
        </div>

        {/* Refund policy */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Refund policy</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>
                  Refunds only for extended service outage
                </div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                  Refunds may be issued only if paid features were unusable due to a verified system error for 15+ consecutive days.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>✅ Eligible: 15+ days outage</Pill>
                <Pill>⚠ Not for “changed mind”</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, ...frame }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InfoCard title="Eligible cases" pill="15+ days">
                  <div style={{ display: "grid", gap: 8 }}>
                    <FeatureRow text="Paid features were unusable due to a verified system error for 15+ consecutive days" />
                    <FeatureRow text="Subscription active but Pro access not granted across devices (verified)" />
                    <FeatureRow text="Billing system failure prevented paid access (verified)" />
                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                      Verification required (screenshots, logs, Stripe receipt, and timestamps).
                    </div>
                  </div>
                </InfoCard>

                <InfoCard title="Not eligible" pill="no guarantee">
                  <div style={{ display: "grid", gap: 8 }}>
                    <FeatureRow text="Changing your mind / no longer studying" />
                    <FeatureRow text="Expected score improvements not achieved" />
                    <FeatureRow text="Issues caused by device/network settings" />
                    <FeatureRow text="Short disruptions under 15 days" />
                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                      No “performance guarantee”.
                    </div>
                  </div>
                </InfoCard>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 950 }}>How to request</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.82, lineHeight: 1.7 }}>
                  Email <b>{CONTACT_EMAIL}</b> with:
                  <div style={{ marginTop: 8 }}>
                    • Purchase date and Stripe receipt (or invoice ID)
                    <br />• Email used for payment
                    <br />• What didn’t work + screenshots/video + dates (15+ day window)
                  </div>
                </div>
              </div>
            </div>
          </SoftCard>
        </div>

        {/* Troubleshooting */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Troubleshooting</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Quick fixes</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>cache</Pill>
                <Pill>storage</Pill>
                <Pill>dev</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, ...frame }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                {[
                  { title: "App looks broken", body: "Hard refresh (Cmd+Shift+R) and reopen the page.", pill: "UI / cache" },
                  { title: "Progress not saving", body: "Disable private mode and allow localStorage in browser settings.", pill: "storage" },
                  { title: "Dev build errors", body: "Stop server → delete .next → restart dev server.", pill: "dev" },
                ].map((c) => (
                  <InfoCard key={c.title} title={c.title} pill={c.pill}>
                    {c.body}
                  </InfoCard>
                ))}
              </div>
            </div>
          </SoftCard>
        </div>

        <div style={{ marginTop: 14, opacity: 0.6, fontSize: 12 }}>© LEXIO · ESTD 2026</div>
      </div>
    </main>
  );
}