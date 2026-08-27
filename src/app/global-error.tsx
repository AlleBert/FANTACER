"use client";

import NextError from "next/error";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  console.error("Unhandled client error:", error);

  return <NextError statusCode={500} />;
}