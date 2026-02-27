"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

const NAV_ITEMS = [
  // ✅ Dashboard is /dashboard (NOT "/")
  { label: "Dashboard", href: "/dashboard" },
  { label: "Practice", href: "/practice" },
  { label: "Mock Tests", href: "/mock-tests" },
  { label: "Reports", href: "/reports" },
  { label: "Kanji", href: "/kanji" },
  { label: "Pricing", href: "/pricing" },
  { label: "Support", href: "/support" },
];

function isActivePath(pathname: string, href: string) {
  // exact match
  if (pathname === href) return true;

  // nested routes (e.g. /practice/session should highlight /practice)
  if (href !== "/" && pathname.startsWith(href + "/")) return true;

  return false;
}

export default function Sidebar() {
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);

  const items = useMemo(() => NAV_ITEMS, []);

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        width: open ? 240 : 22,
        background: "#000",
        borderRight: open ? "1px solid rgba(255,255,255,0.08)" : "none",
        transition: "width 0.25s ease",
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      {/* ===== HANDLE ===== */}
      {!open && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            transform: "translateY(-50%)",
            width: 22,
            height: 80,
            background: "linear-gradient(135deg, #2a2a2a, #111)",
            borderTopRightRadius: 14,
            borderBottomRightRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 0 10px rgba(0,0,0,0.6)",
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: 12,
              opacity: 0.8,
            }}
          >
            &gt;
          </span>
        </div>
      )}

      {/* ===== CONTENT ===== */}
      {open && (
        <div
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          {/* Logo */}
          <div
            style={{
              fontSize: 20,
              fontWeight: 950,
              letterSpacing: -0.5,
              marginBottom: 30,
              color: "white",
            }}
          >
            LEXIO
          </div>

          {/* Nav */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    textDecoration: "none",
                    fontWeight: 900,
                    fontSize: 14,
                    color: active ? "black" : "white",
                    background: active ? "white" : "rgba(255,255,255,0.05)",
                    transition: "all 0.2s ease",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Footer */}
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 20, color: "white" }}>
            © 2026 LEXIO
          </div>
        </div>
      )}
    </div>
  );
}