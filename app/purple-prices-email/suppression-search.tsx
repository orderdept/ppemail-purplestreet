"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  suppressions: string[];
};

export function SuppressionSearch({ suppressions }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (normalizedQuery.length < 3) return [];
    return suppressions.filter((email) => email.toLowerCase().includes(normalizedQuery)).slice(0, 25);
  }, [normalizedQuery, suppressions]);

  async function handleRemove(email: string) {
    if (!window.confirm(`Remove ${email} from the suppression list?`)) return;
    setRemoving(email);
    setMessage("");
    try {
      const response = await fetch("/api/purple-prices/suppressions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { deleted?: boolean; email?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not remove the suppression.");
      setMessage(data.deleted ? `Removed ${data.email} from the live suppression list.` : `${data.email} was not on the suppression list.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove the suppression.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="suppression-search-block">
      <label className="field">
        <span>Search suppressed addresses</span>
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type 3 or more characters"
          type="text"
          value={query}
        />
      </label>

      <div className="suppression-search-results">
        {normalizedQuery.length < 3 ? (
          <p className="inline-status">Start typing at least 3 characters to search the suppression list.</p>
        ) : matches.length ? (
          <>
            <p className="inline-status">
              Found {matches.length}
              {matches.length === 25 ? "+" : ""} match{matches.length === 1 ? "" : "es"}.
            </p>
            <ul className="suppression-match-list">
              {matches.map((email) => (
                <li key={email}>
                  <span>{email}</span>
                  <button
                    className="action-link ghost button-like"
                    disabled={removing !== null}
                    onClick={() => void handleRemove(email)}
                    type="button"
                  >
                    {removing === email ? "Removing..." : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="inline-status">No suppressed addresses match that search.</p>
        )}
      </div>
      {message ? <p className="inline-status">{message}</p> : null}
    </div>
  );
}
