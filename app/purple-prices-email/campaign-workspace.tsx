"use client";

import { useMemo, useRef, useState } from "react";

import { type CampaignContact, type CampaignDraft } from "../../lib/purple-prices-types";

type Props = {
  draft: CampaignDraft;
  suppressions: string[];
};

type DraftContact = CampaignContact & {
  status: "ready" | "duplicate" | "suppressed";
};

const defaultContactName = "Purple Peeps";
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function normalizeEmail(value: string) {
  const match = String(value || "").match(emailPattern);
  return match ? match[0].trim().toLowerCase() : "";
}

function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (cell || row.length) {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = "";
      }
      if (char === "\r" && next === "\n") {
        index += 1;
      }
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((item) => item.some(Boolean));
}

function contactsFromCsv(text: string) {
  const rows = csvRows(text);
  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  const emailIndex = headers.findIndex((header) => ["email", "email_address", "e_mail"].includes(header));
  const nameIndex = headers.findIndex((header) => ["name", "first_name", "customer", "customer_name"].includes(header));
  const dataRows = emailIndex >= 0 ? rows.slice(1) : rows;

  return dataRows
    .map((row) => {
      const email = normalizeEmail(emailIndex >= 0 ? row[emailIndex] || "" : row.join(" "));
      const name = nameIndex >= 0 ? row[nameIndex] || "" : "";
      return email ? { email, name: name || defaultContactName } : null;
    })
    .filter((item): item is CampaignContact => Boolean(item));
}

function contactsFromPaste(text: string) {
  const contacts: CampaignContact[] = [];
  String(text || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const email = normalizeEmail(trimmed);
      if (!email) return;

      const emailIndex = trimmed.toLowerCase().indexOf(email);
      const beforeEmail = emailIndex >= 0 ? trimmed.slice(0, emailIndex) : "";
      const name = beforeEmail
        .replace(/[<,;:"'\s]+$/g, "")
        .replace(/^["']|["']$/g, "")
        .trim();

      contacts.push({ email, name: name || defaultContactName });
    });
  return contacts;
}

function intervalMs(draft: CampaignDraft) {
  const dailyLimit = Math.max(1, Number(draft.dailyLimit || 250));
  const perSecond = Math.max(1, Math.min(5, Number(draft.perSecond || 1)));
  if (draft.spacingMode === "rate") return Math.ceil(1000 / perSecond);
  return Math.ceil((24 * 60 * 60 * 1000) / dailyLimit);
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) {
    const seconds = ms / 1000;
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  }
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatDraftCompletion(readyCount: number, spacing: number) {
  if (!readyCount) return "—";
  return new Date(Date.now() + Math.max(0, readyCount - 1) * spacing).toLocaleString();
}

export function CampaignWorkspace({ draft: initialDraft, suppressions }: Props) {
  const [draft, setDraft] = useState<CampaignDraft>(initialDraft);
  const [csvContacts, setCsvContacts] = useState<CampaignContact[]>(initialDraft.csvContacts);
  const [typedContacts, setTypedContacts] = useState<CampaignContact[]>(initialDraft.typedContacts);
  const [pasteText, setPasteText] = useState(initialDraft.pasteText);
  const [saveStatus, setSaveStatus] = useState("Hosted sending is the next cutover. For now, this saves the live setup and contact list.");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const suppressionsSet = useMemo(() => new Set(suppressions), [suppressions]);
  const contacts = useMemo(() => {
    const seen = new Set<string>();
    return [...csvContacts, ...typedContacts].map<DraftContact>((contact) => {
      if (suppressionsSet.has(contact.email)) {
        return { ...contact, status: "suppressed" };
      }
      if (seen.has(contact.email)) {
        return { ...contact, status: "duplicate" };
      }
      seen.add(contact.email);
      return { ...contact, status: "ready" };
    });
  }, [csvContacts, suppressionsSet, typedContacts]);

  const counts = useMemo(() => {
    const ready = contacts.filter((contact) => contact.status === "ready").length;
    const duplicate = contacts.filter((contact) => contact.status === "duplicate").length;
    const suppressedCount = contacts.filter((contact) => contact.status === "suppressed").length;
    const spacing = intervalMs(draft);
    return {
      ready,
      duplicate,
      suppressedCount,
      spacing,
      window: formatDuration(Math.max(0, ready - 1) * spacing),
      completion: formatDraftCompletion(ready, spacing),
    };
  }, [contacts, draft]);

  async function saveSetup(nextDraft = draft, nextCsvContacts = csvContacts, nextTypedContacts = typedContacts, nextPasteText = pasteText) {
    setSaving(true);
    setSaveStatus("Saving the hosted campaign setup...");
    try {
      const response = await fetch("/api/purple-prices/campaign-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...nextDraft,
          csvContacts: nextCsvContacts,
          typedContacts: nextTypedContacts,
          pasteText: nextPasteText,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not save the hosted campaign setup.");
      }
      setSaveStatus(`Saved ${data.contactCount || 0} contacts to PS.`);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Could not save the hosted campaign setup.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCsvChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const nextCsvContacts = contactsFromCsv(await file.text());
    setCsvContacts(nextCsvContacts);
    await saveSetup(draft, nextCsvContacts, typedContacts, pasteText);
  }

  async function handlePasteChange(value: string) {
    const nextTypedContacts = contactsFromPaste(value);
    setPasteText(value);
    setTypedContacts(nextTypedContacts);
  }

  async function handleClearList() {
    setCsvContacts([]);
    setTypedContacts([]);
    setPasteText("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    await saveSetup(draft, [], [], "");
  }

  const visibleRows = contacts.slice(0, 300);

  return (
    <>
      <section className="stat-grid stat-grid-four">
        <article className="stat-card">
          <span>Ready</span>
          <strong>{counts.ready.toLocaleString()}</strong>
        </article>
        <article className="stat-card">
          <span>Duplicates</span>
          <strong>{counts.duplicate.toLocaleString()}</strong>
        </article>
        <article className="stat-card">
          <span>Suppressed in list</span>
          <strong>{counts.suppressedCount.toLocaleString()}</strong>
        </article>
        <article className="stat-card">
          <span>Send window</span>
          <strong>{counts.window}</strong>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel wide">
          <div className="section-head">
            <div>
              <h2>Customer list</h2>
              <p>Upload CSV, paste addresses, or both. The hosted panel normalizes, dedupes, and checks against the live suppression list.</p>
            </div>
            <div className="button-row">
              <button className="action-link ghost button-like" disabled={saving} onClick={() => void saveSetup()} type="button">
                Save setup
              </button>
              <button className="action-link ghost button-like" disabled={saving} onClick={() => void handleClearList()} type="button">
                Clear list
              </button>
            </div>
          </div>

          <div className="host-form-grid">
            <label className="field">
              <span>Upload CSV</span>
              <input ref={fileInputRef} accept=".csv,.txt" onChange={handleCsvChange} type="file" />
            </label>
            <label className="field">
              <span>Paste email addresses</span>
              <textarea
                onChange={(event) => void handlePasteChange(event.target.value)}
                placeholder={"customer@example.com\nJane Customer <jane@example.com>\nJane Customer, jane@example.com"}
                rows={8}
                value={pasteText}
              />
            </label>
          </div>

          <small className="template-status">{saveStatus}</small>

          <div className="table-wrap top-gap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length ? (
                  visibleRows.map((contact) => (
                    <tr key={`${contact.email}-${contact.status}`}>
                      <td>{contact.email}</td>
                      <td>{contact.name || defaultContactName}</td>
                      <td>
                        <span className={`status-chip ${contact.status}`}>{contact.status}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>No contacts loaded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="section-head">
            <div>
              <h2>SMTP &amp; limits</h2>
              <p>These are the live sending defaults PS will use once the hosted sender takes over.</p>
            </div>
          </div>

          <div className="host-form-grid">
            <label className="field">
              <span>SMTP host</span>
              <input
                onChange={(event) => setDraft((current) => ({ ...current, smtpHost: event.target.value }))}
                value={draft.smtpHost}
              />
            </label>
            <label className="field">
              <span>Port</span>
              <input
                min={1}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, smtpPort: Number(event.target.value || 465) }))
                }
                type="number"
                value={draft.smtpPort}
              />
            </label>
            <label className="field">
              <span>Security</span>
              <select
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    smtpSecurity: event.target.value === "starttls" ? "starttls" : "ssl",
                  }))
                }
                value={draft.smtpSecurity}
              >
                <option value="ssl">SSL/TLS</option>
                <option value="starttls">STARTTLS</option>
              </select>
            </label>
            <label className="field">
              <span>Username / sender email</span>
              <input
                onChange={(event) => setDraft((current) => ({ ...current, smtpUsername: event.target.value }))}
                type="email"
                value={draft.smtpUsername}
              />
            </label>
            <label className="field">
              <span>From name</span>
              <input
                onChange={(event) => setDraft((current) => ({ ...current, fromName: event.target.value }))}
                value={draft.fromName}
              />
            </label>
            <label className="field">
              <span>Daily campaign cap</span>
              <input
                min={1}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, dailyLimit: Number(event.target.value || 800) }))
                }
                type="number"
                value={draft.dailyLimit}
              />
            </label>
            <label className="field">
              <span>Max messages per second</span>
              <input
                max={5}
                min={1}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, perSecond: Number(event.target.value || 3) }))
                }
                type="number"
                value={draft.perSecond}
              />
            </label>
            <label className="field">
              <span>Spacing mode</span>
              <select
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    spacingMode: event.target.value === "daily" ? "daily" : "rate",
                  }))
                }
                value={draft.spacingMode}
              >
                <option value="rate">Use per-second cap</option>
                <option value="daily">Evenly across daily cap</option>
              </select>
            </label>
          </div>

          <div className="button-row">
            <button className="action-link button-like" disabled={saving} onClick={() => void saveSetup()} type="button">
              Save settings
            </button>
          </div>
        </article>

        <article className="panel">
          <h2>Queue plan</h2>
          <div className="meta-stack">
            <div>
              <span>Next send interval</span>
              <strong>{formatDuration(counts.spacing)}</strong>
            </div>
            <div>
              <span>Estimated completion</span>
              <strong>{counts.completion}</strong>
            </div>
            <div>
              <span>Hosted send actions</span>
              <strong>Next cutover step</strong>
            </div>
          </div>
          <p className="top-gap">
            PS now holds the real list and sending defaults. The live send buttons and hosted scheduler are the next slice, so we do not accidentally half-cut over the mailer.
          </p>
        </article>
      </section>
    </>
  );
}
