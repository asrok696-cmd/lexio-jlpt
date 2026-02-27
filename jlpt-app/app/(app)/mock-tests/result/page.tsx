// app/(app)/mock-tests/result/page.tsx
import React from "react";
import ResultClient from "./ResultClient";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default function MockResultPage({ searchParams }: { searchParams: SP }) {
  return <ResultClient searchParams={searchParams} />;
}