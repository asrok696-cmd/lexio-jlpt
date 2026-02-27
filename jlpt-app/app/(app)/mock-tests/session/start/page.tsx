// app/(app)/mock-tests/session/start/page.tsx
import React from "react";
import StartClient from "./StartClient";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default function MockStartPage({ searchParams }: { searchParams: SP }) {
  return <StartClient searchParams={searchParams} />;
}