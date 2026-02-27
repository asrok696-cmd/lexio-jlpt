export default function StartPage() {
  // middlewareが自動で振り分けるので、ここは“存在するだけ”でOK
  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "white", display: "grid", placeItems: "center" }}>
      <div style={{ fontWeight: 900, opacity: 0.8 }}>Redirecting…</div>
    </main>
  );
}