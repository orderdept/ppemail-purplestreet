"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ImportResult = {
  suppressionCount: number;
  campaignSubject: string;
  bounceCount: number;
  delayedCount: number;
  unsubscribeCount: number;
  movedCount: number;
  movedDelayedCount: number;
  movedUnsubCount: number;
};

export function ImportBouncesButton({
  campaignSubject = "",
  smtpUsername = "",
}: {
  campaignSubject?: string;
  smtpUsername?: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [suppressionEmail, setSuppressionEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [smtpPassword, setSmtpPassword] = useState("");

  useEffect(() => {
    const syncPassword = () => {
      setSmtpPassword(window.sessionStorage.getItem("purple-prices-email-password") || "");
    };
    syncPassword();
    window.addEventListener("purple-prices-password-changed", syncPassword as EventListener);
    return () => {
      window.removeEventListener("purple-prices-password-changed", syncPassword as EventListener);
    };
  }, []);

  async function handleImport() {
    setIsLoading(true);
    setIsError(false);
    setMessage("");
    try {
      const response = await fetch("/api/purple-prices/import-bounces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignSubject,
          password: smtpPassword,
          username: smtpUsername,
        }),
      });
      const data = (await response.json()) as ImportResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Import Bounces could not finish.");
      }
      setMessage(
        `Imported ${data.bounceCount} bounced addresses for "${data.campaignSubject || campaignSubject}", ${data.unsubscribeCount} unsubscribe replies, and moved ${data.movedCount} bounced, ${data.movedDelayedCount} delayed, and ${data.movedUnsubCount} unsubscribe inbox notices.`,
      );
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Import Bounces could not finish.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddSuppression() {
    setIsAdding(true);
    setIsError(false);
    setMessage("");
    try {
      const response = await fetch("/api/purple-prices/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: suppressionEmail }),
      });
      const data = (await response.json()) as { added?: boolean; email?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not add the suppression.");
      }
      setSuppressionEmail("");
      setMessage(
        data.added
          ? `Added ${data.email} to the live suppression list.`
          : `${data.email} was already suppressed.`,
      );
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not add the suppression.");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="live-action-stack">
      <div className="button-row">
        <button
          className="action-button"
          disabled={isLoading || !smtpPassword.trim()}
          onClick={handleImport}
          type="button"
        >
          {isLoading ? "Importing..." : "Import Bounces"}
        </button>
      </div>
      <div className="inline-form">
        <input
          className="inline-input"
          onChange={(event) => setSuppressionEmail(event.target.value)}
          placeholder="customer@example.com"
          type="email"
          value={suppressionEmail}
        />
        <button
          className="action-link ghost button-like"
          disabled={isAdding}
          onClick={handleAddSuppression}
          type="button"
        >
          {isAdding ? "Adding..." : "Add"}
        </button>
      </div>
      <p className={`inline-status ${isError ? "error-text" : ""}`}>
        {message ||
          (smtpPassword.trim()
            ? `Scans the inbox for notices tied to "${campaignSubject || "the current campaign"}", files them, updates live suppressions, and lets you add one-offs by hand.`
            : "Add the mailbox password in Step 3 before importing bounces.")}
      </p>
    </div>
  );
}
