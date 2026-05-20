"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { type CampaignDraft, type SavedTemplate } from "../../lib/purple-prices-types";

type Props = {
  draft: CampaignDraft;
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

export function TemplateManager({ draft, templates }: Props) {
  const router = useRouter();
  const sortedTemplates = useMemo(
    () =>
      [...templates].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    [templates],
  );
  const [selectedName, setSelectedName] = useState(draft.draftMessageName || "");
  const [draftName, setDraftName] = useState(draft.draftMessageName || "");
  const [subject, setSubject] = useState(draft.messageSubject || "");
  const [previewText, setPreviewText] = useState(draft.messagePreviewText || "");
  const [body, setBody] = useState(draft.messageBody || "");
  const [mailingAddress, setMailingAddress] = useState(draft.messageMailingAddress || "");
  const [status, setStatus] = useState(
    sortedTemplates.length
      ? "Choose a saved message for this campaign or save your edits."
      : "No saved messages yet for this campaign.",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPersistingDraft, setIsPersistingDraft] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedTemplate = sortedTemplates.find((template) => template.name === selectedName) || null;

  useEffect(() => {
    setSelectedName(draft.draftMessageName || "");
    setDraftName(draft.draftMessageName || "");
    setSubject(draft.messageSubject || "");
    setPreviewText(draft.messagePreviewText || "");
    setBody(draft.messageBody || "");
    setMailingAddress(draft.messageMailingAddress || "");
  }, [
    draft.draftMessageName,
    draft.messageBody,
    draft.messageMailingAddress,
    draft.messagePreviewText,
    draft.messageSubject,
  ]);

  async function persistDraftMessage(next: {
    draftMessageName?: string;
    subject?: string;
    previewText?: string;
    body?: string;
    mailingAddress?: string;
  }) {
    setIsPersistingDraft(true);
    try {
      const response = await fetch("/api/purple-prices/campaign-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          campaignName: draft.campaignName,
          draftMessageName: next.draftMessageName ?? draftName,
          messageSubject: next.subject ?? subject,
          messagePreviewText: next.previewText ?? previewText,
          messageBody: next.body ?? body,
          messageMailingAddress: next.mailingAddress ?? mailingAddress,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not save the campaign message.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save the campaign message.");
    } finally {
      setIsPersistingDraft(false);
    }
  }

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
    void persistDraftMessage({
      draftMessageName: template.name,
      subject: template.message.subject || "",
      previewText: template.message.previewText || "",
      body: template.message.body || "",
      mailingAddress: template.message.mailingAddress || "",
    });
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
          campaignName: draft.campaignName,
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
        `/api/purple-prices/templates?campaignName=${encodeURIComponent(draft.campaignName)}&name=${encodeURIComponent(name)}`,
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
    void persistDraftMessage({
      draftMessageName: "",
      subject: "",
      previewText: "",
      body: "",
      mailingAddress: "",
    });
  }

  function updateBodyWithSelection(nextValue: string, nextStart: number, nextEnd = nextStart) {
    setBody(nextValue);
    window.requestAnimationFrame(() => {
      bodyRef.current?.focus();
      bodyRef.current?.setSelectionRange(nextStart, nextEnd);
    });
    void persistDraftMessage({ body: nextValue });
  }

  function insertBullets() {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end);
    const source = selected || "First point\nSecond point";
    const bulleted = source
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        return trimmed ? `- ${trimmed.replace(/^\s*[-*]\s+/, "")}` : "";
      })
      .join("\n");
    const nextBody = `${body.slice(0, start)}${bulleted}${body.slice(end)}`;
    updateBodyWithSelection(nextBody, start, start + bulleted.length);
  }

  function insertLink() {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end).trim() || "link text";
    const url = window.prompt("Paste the link URL", "https://");
    if (!url) return;
    const linkText = `[${selected}](${url.trim()})`;
    const nextBody = `${body.slice(0, start)}${linkText}${body.slice(end)}`;
    updateBodyWithSelection(nextBody, start + 1, start + 1 + selected.length);
  }

  return (
    <article className="panel wide">
      <div className="section-head host-section-head">
        <div>
          <p className="section-step">Step 1</p>
          <h2>Shape the message</h2>
          <p>Keep reusable campaign copy here so subject, preview text, body, and footer stay in sync for this campaign only.</p>
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
        <small className="template-status">
          {isPersistingDraft ? "Saving campaign draft..." : status}
        </small>
      </div>

      <div className="form-grid host-form-grid">
        <label className="field">
          <span>Subject</span>
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            onBlur={() => void persistDraftMessage({ subject })}
          />
        </label>
        <label className="field">
          <span>Inbox preview</span>
          <input
            type="text"
            value={previewText}
            onChange={(event) => setPreviewText(event.target.value)}
            onBlur={() => void persistDraftMessage({ previewText })}
          />
        </label>
        <label className="field full">
          <span>Campaign message</span>
          <div className="button-row template-actions">
            <button className="action-link ghost button-like" onClick={insertBullets} type="button">
              Add bullets
            </button>
            <button className="action-link ghost button-like" onClick={insertLink} type="button">
              Add link
            </button>
          </div>
          <textarea
            ref={bodyRef}
            rows={14}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onBlur={() => void persistDraftMessage({ body })}
          />
        </label>
        <label className="field full">
          <span>Footer mailing address</span>
          <textarea
            rows={3}
            value={mailingAddress}
            onChange={(event) => setMailingAddress(event.target.value)}
            onBlur={() => void persistDraftMessage({ mailingAddress })}
          />
        </label>
      </div>
    </article>
  );
}
