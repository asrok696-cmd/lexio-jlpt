"use client";

import Link from "next/link";
import React from "react";

// -----------------------------
// MockTests-like UI atoms (single source of truth)
// -----------------------------
export const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 18% 18%, rgba(120,90,255,0.16) 0%, rgba(0,0,0,0.0) 35%), radial-gradient(circle at 70% 25%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.0) 40%), #050507",
  color: "rgba(255,255,255,0.92)",
};

export const container: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: 24,
};

export function SoftCard({ children }: { children: React.ReactNode }) {
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

export function Pill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(120,90,255,0.22)" : "rgba(255,255,255,0.06)",
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(255,255,255,0.88)",
    whiteSpace: "nowrap",
    userSelect: "none",
  };

  if (!onClick) return <div style={base}>{children}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...base,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function NavBtn({ href, children }: { href: string; children: React.ReactNode }) {
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

export const frame: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
  padding: 14,
  boxSizing: "border-box",
};

export function PrimaryLinkBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        borderRadius: 14,
        padding: "12px 14px",
        background: "rgba(120, 90, 255, 0.92)",
        color: "white",
        fontWeight: 950,
        textAlign: "center",
        display: "block",
      }}
    >
      {children}
    </Link>
  );
}

export function GhostLinkBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        borderRadius: 14,
        padding: "12px 14px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        color: "white",
        fontWeight: 950,
        textAlign: "center",
        display: "block",
      }}
    >
      {children}
    </Link>
  );
}

export function PrimaryBtn({
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: "none",
        background: disabled ? "rgba(255,255,255,0.10)" : "rgba(120, 90, 255, 0.92)",
        color: "white",
        fontWeight: 950,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function GhostBtn({
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
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        color: "white",
        fontWeight: 950,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 0.95,
      }}
    >
      {children}
    </button>
  );
}

export function H1({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <div style={{ fontSize: 44, fontWeight: 950, letterSpacing: -0.5 }}>{title}</div>
      {subtitle ? <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>{subtitle}</div> : null}
    </div>
  );
}