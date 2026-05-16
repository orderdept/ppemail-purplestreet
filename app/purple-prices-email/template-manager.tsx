"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { type SavedTemplate } from "../../lib/purple-prices-types";

type Props = {
  initialTemplate: SavedTemplate | null;
  templates: SavedTemplate[];
};

type SaveResponse = {
  error?: string;
  replaced?: boolean;
};

function blankMessage() {
  return {
    subject: "",
    previewText: "",
    body: "",
    mailingAddress: "",
  };
}

export function TemplateManager({ initialTemplate, templates }: Props) {
  const router = useRouter();
  const sortedTemplates = useMemo(
    () =>
      [...templates].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    [templates],
  );
  const [selectedName, setSelectedName] = useState(initialTemplate?.name || "");
  const [draftName, setDraftName] = useState(initialTemplate?.name || "");
  const [subject, setSubject] = useState(initialTemplate?.message.subject || "");
  const [previewText, setPreviewText] = useState(
    initialTemplate?.message.previewText || "",
  );
  const [body, setBody] = useState(initialTemplate?.message.body || "");
  const [mailingAddress, setMailingAddress] = useState(
    initialTemplate?.message.mailingAddress || "",
  );
  const [status, setStatus] = useState(
    sortedTemplates.length ? "Choose a saved message or save your edits." : "No saved messages yet.",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const selectedTemplate = sortedTemplates.find((template) => template.name === selectedName) || null;

  function applyTemplate(template: SavedTemplate | null) {
    if (!template) {
      return;
    }
    setSelectedName(template.name);
    setDraftName(template.name);
    setSubject(template.message.subject || "");
    setPreviewText(template.message.previewText || "");
    setBody(template.message.body || "");
    setMailingAddress(template.message.mailingAddress || "");
    setStatus(`Loaded "${template.name}".`);
  }

  async function handleSave() {
    const name = draftName.trim();
    if (!name) {
      setStatus("Give the message a name before saving it.");
      return;
    }
    setIsSaving(true);
    setStatus("Saving message...");
    try {
      const response = await fetch("/api/purple-prices/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          message: { subject, previewText, body, mailingAddress },
        }),
      });
      const data = (await response.json()) as SaveResponse;
      if (!response.ok) {
        throw new Error(data.error || "Could not save the message.");
      }
      setSelectedName(name);
      setDraftName(name);
      setStatus(data.replaced ? `Updated "${name}".` : `Saved "${name}".`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save the message.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    const name = selectedName || draftName.trim();
    if (!name) {
      setStatus("Choose a saved message before deleting.");
      return;
    }
    setIsDeleting(true);
    setStatus(`Deleting "${name}"...`);
    try {
      const response = await fetch(
        `/api/purple-prices/templates?name=${encodeURIComponent(name)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { error?: string; deleted?: boolean };
      if (!response.ok) {
        throw new Error(data.error || "Could not delete the message.");
      }
      setSelectedName("");
      setDraftName("");
      setSubject("");
      setPreviewText("");
      setBody("");
      setMailingAddress("");
      setStatus(data.deleted ? `Deleted "${name}".` : `No saved message named "${name}" was found.`);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete the message.");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleReset() {
    setSelectedName("");
    setDraftName("");
    const empty = blankMessage();
    setSubject(empty.subject);
    setPreviewText(empty.previewText);
    setBody(empty.body);
    setMailingAddress(empty.mailingAddress);
    setStatus("Started a new draft.");
  }

  return (
    <article className="panel wide">
      <div className="section-head host-section-head">
        <div>
          <p className="section-step">Step 1</p>
          <h2>Shape the message</h2>
          <p>Keep reusable campaign copy here so subject, preview text, body, and footer stay in sync.</p>
        </div>
      </div>

      <div className="template-bar host-template-bar" aria-label="Saved messages">
        <label className="field">
          <span>Saved message</span>
          <select
            value={selectedName}
            onChange={(event) => {
              const name = event.target.value;
              setSelectedName(name);
              const nextTemplate =
                sortedTemplates.find((template) => template.name === name) || null;
              if (nextTemplate) {
                applyTemplate(nextTemplate);
              }
            }}
          >
            <option value="">
              {sortedTemplates.length ? "Choose a saved message" : "No saved messages"}
            </option>
            {sortedTemplates.map((template) => (
              <option key={template.name} value={template.name}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Save as</span>
          <input
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Message name"
          />
        </label>
        <div className="button-row template-actions">
          <button className="action-button" disabled={isSaving} onClick={handleSave} type="button">
            {isSaving ? "Saving..." : "Save Message"}
          </button>
          <button
            className="action-link ghost button-like"
            disabled={!selectedTemplate}
            onClick={() => applyTemplate(selectedTemplate)}
            type="button"
          >
            Load
          </button>
          <button
            className="action-link ghost button-like"
            disabled={isDeleting || (!selectedName && !draftName.trim())}
            onClick={handleDelete}
            type="button"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
          <button className="action-link ghost button-like" onClick={handleReset} type="button">
            New Draft
          </button>
        </div>
        <small className="template-status">{status}</small>
      </div>

      <div className="form-grid host-form-grid">
        <label className="field">
          <span>Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Inbox preview</span>
          <input
            type="text"
            value={previewText}
            onChange={(event) => setPreviewText(event.target.value)}
          />
        </label>
        <label className="field full">
          <span>Campaign message</span>
          <textarea
            rows={14}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <label className="field full">
          <span>Footer mailing address</span>
          <textarea
            rows={3}
            value={mailingAddress}
            onChange={(event) => setMailingAddress(event.target.value)}
          />
        </label>
      </div>
    </article>
  );
}
