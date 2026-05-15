"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ImportResult = {
  suppressionCount: number;
  bounceCount: number;
  delayedCount: number;
  unsubscribeCount: number;
  movedCount: number;
  movedDelayedCount: number;
  movedUnsubCount: number;
};

export function ImportBouncesButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleImport() {
    setIsLoading(true);
    setIsError(false);
    setMessage("");
    try {
      const response = await fetch("/api/purple-prices/import-bounces", {
        method: "POST",
      });
      const data = (await response.json()) as ImportResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Import Bounces could not finish.");
      }
      setMessage(
        `Imported ${data.bounceCount} bounced addresses, ${data.unsubscribeCount} unsubscribe replies, and moved ${data.movedCount} bounced, ${data.movedDelayedCount} delayed, and ${data.movedUnsubCount} unsubscribe inbox notices.`,
      );
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Import Bounces could not finish.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="live-action-stack">
      <button
        className="action-button"
        disabled={isLoading}
        onClick={handleImport}
        type="button"
      >
        {isLoading ? "Importing..." : "Import Bounces"}
      </button>
      <p className={`inline-status ${isError ? "error-text" : ""}`}>
        {message || "Scans the inbox, files bounce notices, and updates live suppressions."}
      </p>
    </div>
  );
}
