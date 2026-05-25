"use client";

import { useMemo, useState } from "react";

import { type CampaignDraft } from "../../lib/purple-prices-types";

type CampaignHistoryItem = {
  id: string;
  status?: string;
  subject?: string;
  total?: number;
  sent?: number;
  failed?: number;
  createdAt?: string;
  completedAt?: string | null;
};

type Props = {
  draft: CampaignDraft;
  campaigns: CampaignHistoryItem[];
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function compactNumber(value?: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function suggestedCampaignName() {
  return `Purple Prices Campaign ${new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  })}`;
}

export function CampaignDesk({ draft, campaigns }: Props) {
  const [campaignName, setCampaignName] = useState(draft.campaignName || "");
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaigns[0]?.id || "");
  const [status, setStatus] = useState("Name the campaign first so the draft has a clear home.");
  const [isSaving, setIsSaving] = useState(false);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) || campaigns[0] || null,
    [campaigns, selectedCampaignId],
  );

  async function saveCampaignShell(nextName: string, resetList = false) {
    setIsSaving(true);
    setStatus(resetList ? "Starting a new campaign draft..." : "Saving campaign name...");
    try {
      const response = await fetch("/api/purple-prices/campaign-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          campaignName: nextName,
          draftMessageName: resetList ? "" : draft.draftMessageName,
          messageSubject: resetList ? "" : draft.messageSubject,
          messagePreviewText: resetList ? "" : draft.messagePreviewText,
          messageBody: resetList ? "" : draft.messageBody,
          messageMailingAddress: resetList ? "" : draft.messageMailingAddress,
          csvContacts: resetList ? [] : draft.csvContacts,
          typedContacts: resetList ? [] : draft.typedContacts,
          pasteText: resetList ? "" : draft.pasteText,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not save the campaign.");
      }
      setCampaignName(nextName);
      setStatus(resetList ? `Started a fresh draft: ${nextName}` : `Saved campaign name: ${nextName}`);
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save the campaign.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="campaign-desk panel">
      <div className="section-head">
        <div>
          <p className="section-step">Before Step 1</p>
          <h2>Campaign desk</h2>
          <p>Start a fresh campaign draft, name it, and jump back into older campaign stats when you need context.</p>
        </div>
      </div>

      <div className="split-grid">
        <div className="campaign-desk-block">
          <label className="field">
            <span>Current draft campaign</span>
            <input
              onChange={(event) => setCampaignName(event.target.value)}
              placeholder="Purple Prices Campaign"
              type="text"
              value={campaignName}
            />
          </label>
          <div className="button-row">
            <button
              className="action-link"
              disabled={isSaving || !campaignName.trim()}
              onClick={() => void saveCampaignShell(campaignName.trim())}
              type="button"
            >
              {isSaving ? "Saving..." : "Save campaign name"}
            </button>
            <button
              className="action-link ghost button-like"
              disabled={isSaving}
              onClick={() => void saveCampaignShell(campaignName.trim() || suggestedCampaignName(), true)}
              type="button"
            >
              Start new campaign
            </button>
          </div>
          <p className="inline-status">{status}</p>
        </div>

        <div className="campaign-desk-block">
          <label className="field">
            <span>Recent campaigns</span>
            <select
              onChange={(event) => setSelectedCampaignId(event.target.value)}
              value={selectedCampaignId}
            >
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {(campaign.subject || "Untitled campaign").slice(0, 70)}
                </option>
              ))}
            </select>
          </label>

          {selectedCampaign ? (
            <div className="checklist-block top-gap">
              <div className="checklist-row">
                <span>Status</span>
                <strong>{selectedCampaign.status || "—"}</strong>
              </div>
              <div className="checklist-row">
                <span>Total recipients</span>
                <strong>{compactNumber(selectedCampaign.total)}</strong>
              </div>
              <div className="checklist-row">
                <span>Sent / failed</span>
                <strong>
                  {compactNumber(selectedCampaign.sent)} / {compactNumber(selectedCampaign.failed)}
                </strong>
              </div>
              <div className="checklist-row">
                <span>Created</span>
                <strong>{formatDateTime(selectedCampaign.createdAt)}</strong>
              </div>
              <div className="checklist-row">
                <span>Completed</span>
                <strong>{formatDateTime(selectedCampaign.completedAt)}</strong>
              </div>
            </div>
          ) : (
            <p className="inline-status">No older campaign history yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
