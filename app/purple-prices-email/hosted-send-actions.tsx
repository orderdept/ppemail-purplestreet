"use client";

import { useState } from "react";

type Props = {
  templateName?: string | null;
};

export function HostedSendActions({ templateName }: Props) {
  const [isTestingLogin, setIsTestingLogin] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [message, setMessage] = useState(
    templateName
      ? `Send Test uses the currently saved message template: ${templateName}.`
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
      const response = await fetch(path, { method: "POST" });
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

  return (
    <div className="live-action-stack top-gap">
      <div className="button-row">
        <button
          className="action-link ghost button-like"
          disabled={isTestingLogin}
          onClick={() => void runAction("/api/purple-prices/smtp-test", "login")}
          type="button"
        >
          {isTestingLogin ? "Testing login..." : "Test Login"}
        </button>
        <button
          className="action-button"
          disabled={isSendingTest || !templateName}
          onClick={() => void runAction("/api/purple-prices/send-test", "send")}
          type="button"
        >
          {isSendingTest ? "Sending test..." : "Send Test"}
        </button>
      </div>
      <p className={`inline-status ${isError ? "error-text" : ""}`}>{message}</p>
    </div>
  );
}
