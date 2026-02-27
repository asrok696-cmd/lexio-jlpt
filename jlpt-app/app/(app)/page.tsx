// app/(app)/layout.tsx
"use client";

import React from "react";
import Sidebar from "../_components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#000", color: "white" }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}