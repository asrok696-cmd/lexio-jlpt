"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <SignIn
        appearance={{
          elements: {
            card: {
              background: "#111",
              color: "white",
              borderRadius: "16px",
            },
          },
        }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/start"
      />
    </main>
  );
}