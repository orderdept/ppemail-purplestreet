"use client";

import { useEffect, useState } from "react";

import { type CampaignDraft, type SavedTemplate } from "../../lib/purple-prices-types";
import { CampaignDesk } from "./campaign-desk";
import { CampaignWorkspace } from "./campaign-workspace";
import { ImportBouncesButton } from "./import-bounces-button";
import { SuppressionSearch } from "./suppression-search";
import { TemplateManager } from "./template-manager";

type WorkflowTab = "desk" | "message" | "audience" | "delivery" | "final" | "hygiene" | "logs";

type CampaignHistoryRow = {
  id: string;
  subject?: string;
  status?: string;
  total?: number;
  sent?: number;
  failed?: number;
  createdAt?: string;
  completedAt?: string | null;
};

type Props = {
  campaigns: CampaignHistoryRow[];
  draft: CampaignDraft;
  latestCampaign?: {
    completedAt?: string | null;
  } | null;
  recentFailures: Array<{
    email: string;
    error?: string;
    recordedAt?: string;
  }>;
  recentLog: string[];
  suppressions: string[];
  templates: SavedTemplate[];
  currentCampaign: {
    total?: number;
    sent?: number;
    failed?: number;
    dailyLimit?: number;
    intervalMs?: number;
    currentBatch?: number;
    totalBatches?: number;
  };
};

const tabStorageKey = "purple-prices-workflow-tab";

const tabs: Array<{ id: WorkflowTab; label: string }> = [
  { id: "desk", label: "Campaign Desk" },
  { id: "message", label: "Message" },
  { id: "audience", label: "Audience" },
  { id: "delivery", label: "Delivery" },
  { id: "final", label: "Final Check" },
  { id: "hygiene", label: "Hygiene" },
  { id: "logs", label: "Logs" },
];

function compactNumber(value?: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRate(intervalMs?: number) {
  if (!intervalMs || intervalMs <= 0) return "—";
  const perSecond = 1000 / intervalMs;
  return `${perSecond.toFixed(perSecond >= 2 ? 0 : 1)}/sec`;
}

export function WorkflowTabs({
  campaigns,
  currentCampaign,
  draft,
  latestCampaign,
  recentFailures,
  recentLog,
  suppressions,
  templates,
}: Props) {
  const [activeTab, setActiveTab] = useState<WorkflowTab>("desk");
  const remaining = Math.max(
    0,
    (currentCampaign.total || 0) - (currentCampaign.sent || 0) - (currentCampaign.failed || 0),
  );

  useEffect(() => {
    const saved = window.sessionStorage.getItem(tabStorageKey);
    if (saved && tabs.some((tab) => tab.id === saved)) {
      setActiveTab(saved as WorkflowTab);
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(tabStorageKey, activeTab);
  }, [activeTab]);

  return (
    <section className="workflow-tab-shell">
      <div className="tab-row workflow-tab-row" role="tablist" aria-label="Campaign workflow">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            aria-controls={`workflow-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
            id={`workflow-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        aria-labelledby="workflow-tab-desk"
        className="tab-panel"
        hidden={activeTab !== "desk"}
        id="workflow-panel-desk"
        role="tabpanel"
      >
        <CampaignDesk draft={draft} campaigns={campaigns} />
      </div>

      <div
        aria-labelledby="workflow-tab-message"
        className="tab-panel"
        hidden={activeTab !== "message"}
        id="workflow-panel-message"
        role="tabpanel"
      >
        <TemplateManager draft={draft} templates={templates} />
      </div>

      <div
        aria-labelledby="workflow-tab-audience"
        className="tab-panel"
        hidden={activeTab !== "audience"}
        id="workflow-panel-audience"
        role="tabpanel"
      >
        <CampaignWorkspace
          activeStep="audience"
          draft={draft}
          suppressions={suppressions}
          templateName={draft.draftMessageName || null}
        />
      </div>

      <div
        aria-labelledby="workflow-tab-delivery"
        className="tab-panel"
        hidden={activeTab !== "delivery"}
        id="workflow-panel-delivery"
        role="tabpanel"
      >
        <CampaignWorkspace
          activeStep="delivery"
          draft={draft}
          suppressions={suppressions}
          templateName={draft.draftMessageName || null}
        />
      </div>

      <div
        aria-labelledby="workflow-tab-final"
        className="tab-panel"
        hidden={activeTab !== "final"}
        id="workflow-panel-final"
        role="tabpanel"
      >
        <div className="workflow-stack">
          <CampaignWorkspace
            activeStep="final"
            draft={draft}
            suppressions={suppressions}
            templateName={draft.draftMessageName || null}
          />

          <article className="panel wide">
            <div className="module-row">
              <div>
                <p className="section-step">Campaign snapshot</p>
                <h2>Draft readiness at a glance</h2>
                <p>Use this to sanity-check the campaign you are building before you send it.</p>
              </div>
            </div>

            <div className="detail-grid">
              <div className="detail-item">
                <span>Total recipients</span>
                <strong>{compactNumber(currentCampaign.total)}</strong>
              </div>
              <div className="detail-item">
                <span>Remaining</span>
                <strong>{compactNumber(remaining)}</strong>
              </div>
              <div className="detail-item">
                <span>Daily limit</span>
                <strong>{compactNumber(currentCampaign.dailyLimit)}</strong>
              </div>
              <div className="detail-item">
                <span>Send rate</span>
                <strong>{formatRate(currentCampaign.intervalMs)}</strong>
              </div>
              <div className="detail-item">
                <span>Batches</span>
                <strong>
                  {currentCampaign.currentBatch || 0}/{currentCampaign.totalBatches || 0}
                </strong>
              </div>
              <div className="detail-item">
                <span>Last completed send</span>
                <strong>{formatDateTime(latestCampaign?.completedAt)}</strong>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div
        aria-labelledby="workflow-tab-hygiene"
        className="tab-panel"
        hidden={activeTab !== "hygiene"}
        id="workflow-panel-hygiene"
        role="tabpanel"
      >
        <article className="panel">
          <p className="section-step">List hygiene</p>
          <h2>Suppressions</h2>
          <p>{compactNumber(suppressions.length)} addresses are excluded from future sends.</p>
          <div className="button-row">
            <ImportBouncesButton campaignSubject={campaigns[0]?.subject || ""} smtpUsername={draft.smtpUsername} />
          </div>
          <div className="button-row">
            <a className="action-link" href="/api/purple-prices/suppressions/export.csv">
              Download CSV
            </a>
            <a className="action-link ghost" href="/api/purple-prices/suppressions/export.json">
              Download JSON
            </a>
          </div>
          <SuppressionSearch suppressions={suppressions} />
        </article>
      </div>

      <div
        aria-labelledby="workflow-tab-logs"
        className="tab-panel"
        hidden={activeTab !== "logs"}
        id="workflow-panel-logs"
        role="tabpanel"
      >
        <div className="workflow-stack">
          <article className="panel">
            <p className="section-step">Delivery watch</p>
            <h2>Recent failed deliveries</h2>
            {recentFailures.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentFailures.map((row) => (
                      <tr key={`${row.email}-${row.recordedAt || row.error}`}>
                        <td>{row.email}</td>
                        <td>{row.error || "Delivery failed"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No recent failed deliveries recorded.</p>
            )}
          </article>

          <article className="panel">
            <p className="section-step">Activity</p>
            <h2>Recent send log</h2>
            <ul className="activity-list">
              {recentLog.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
