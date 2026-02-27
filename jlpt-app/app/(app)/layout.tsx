// app/(app)/layout.tsx
import React from "react";
import Sidebar from "@/app/_components/Sidebar";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "rgba(255,255,255,0.92)" }}>
      <Sidebar />
      <main style={{ minHeight: "100vh" }}>{children}</main>
    </div>
  );
}