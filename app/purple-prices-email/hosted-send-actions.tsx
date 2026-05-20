"use client";

import { useState } from "react";

type Props = {
  canStartCampaign: boolean;
  readyCount: number;
  smtpPassword: string;
  smtpUsername: string;
  templateName?: string | null;
};

export function HostedSendActions({ canStartCampaign, readyCount, smtpPassword, smtpUsername, templateName }: Props) {
  const [isTestingLogin, setIsTestingLogin] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isStartingCampaign, setIsStartingCampaign] = useState(false);
  const [message, setMessage] = useState(
    templateName
      ? `Send Test will use the saved message template: ${templateName}.`
      : "Save a message template before trying the hosted test send.",
  );
  const [isError, setIsError] = useState(false);

  async function runAction(path: string, kind: "login" | "send") {
    if (kind === "login") {
      setIsTestingLogin(true);
    } else {
      setIsSendingTest(true);
    }
    setIsError(false);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: smtpPassword,
          username: smtpUsername,
        }),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.error || "That hosted mail action could not finish.");
      }
      setMessage(data.message || "Done.");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "That hosted mail action could not finish.");
    } finally {
      if (kind === "login") {
        setIsTestingLogin(false);
      } else {
        setIsSendingTest(false);
      }
    }
  }

  async function handleStartCampaign() {
    if (!canStartCampaign) {
      setIsError(true);
      setMessage("Save a message and make sure at least one contact is ready before starting the campaign.");
      return;
    }
    if (!window.confirm(`Start the live campaign for ${readyCount} ready recipients?`)) {
      return;
    }
    setIsStartingCampaign(true);
    setIsError(false);
    try {
      const response = await fetch("/api/purple-prices/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: smtpPassword,
          username: smtpUsername,
        }),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.error || "That hosted campaign could not start.");
      }
      setMessage(data.message || "Campaign started.");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "That hosted campaign could not start.");
    } finally {
      setIsStartingCampaign(false);
    }
  }

  return (
    <div className="live-action-stack top-gap">
      <div className="button-row">
        <button
          className="action-link ghost button-like"
          disabled={isTestingLogin || !smtpPassword.trim()}
          onClick={() => void runAction("/api/purple-prices/smtp-test", "login")}
          type="button"
        >
          {isTestingLogin ? "Testing login..." : "Check sender login"}
        </button>
        <button
          className="action-button"
          disabled={isSendingTest || !templateName || !smtpPassword.trim()}
          onClick={() => void runAction("/api/purple-prices/send-test", "send")}
          type="button"
        >
          {isSendingTest ? "Sending test..." : "Send live test"}
        </button>
        <button
          className="action-button"
          disabled={isStartingCampaign || !canStartCampaign || !smtpPassword.trim()}
          onClick={() => void handleStartCampaign()}
          type="button"
        >
          {isStartingCampaign ? "Starting campaign..." : "Start campaign"}
        </button>
      </div>
      <p className={`inline-status ${isError ? "error-text" : ""}`}>{message}</p>
    </div>
  );
}
