"use client";

import { useMemo, useState } from "react";

type Props = {
  suppressions: string[];
};

export function SuppressionSearch({ suppressions }: Props) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (normalizedQuery.length < 3) return [];
    return suppressions.filter((email) => email.toLowerCase().includes(normalizedQuery)).slice(0, 25);
  }, [normalizedQuery, suppressions]);

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
                <li key={email}>{email}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="inline-status">No suppressed addresses match that search.</p>
        )}
      </div>
    </div>
  );
}
