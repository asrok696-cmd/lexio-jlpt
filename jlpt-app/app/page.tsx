// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        color: "white",
      }}
    >
      <img
        src="/lexio-logo.png"
        alt="LEXIO"
        style={{
          width: 350,
          height: "auto",
          marginBottom: 40,
          opacity: 0.95,
          userSelect: "none",
        }}
      />

      <Link
        href="/start"
        style={{
          padding: "14px 28px",
          borderRadius: 12,
          background: "#fff",
          color: "#000",
          fontWeight: 900,
          textDecoration: "none",
          fontSize: 16,
          transition: "all 0.2s ease",
        }}
      >
        Start
      </Link>
    </main>
  );
}