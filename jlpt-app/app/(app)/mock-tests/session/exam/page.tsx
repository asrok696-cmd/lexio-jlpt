// app/(app)/mock-tests/session/exam/page.tsx
import React from "react";
import ExamClient from "./ExamClient";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default function MockExamPage({ searchParams }: { searchParams: SP }) {
  return <ExamClient searchParams={searchParams} />;
}