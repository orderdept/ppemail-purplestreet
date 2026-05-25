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
    subject?: string;
    status?: string;
    total?: number;
    sent?: number;
    failed?: number;
    dailyLimit?: number;
    intervalMs?: number;
    currentBatch?: number;
    totalBatches?: number;
    completedAt?: string | null;
  };
};

const tabStorageKey = "purple-prices-workflow-tab";

const tabs: Array<{ id: WorkflowTab; label: string; navLabel: string; description: string }> = [
  {
    id: "desk",
    label: "Campaign Desk",
    navLabel: "Campaigns",
    description: "Create a campaign draft or load older campaign records.",
  },
  {
    id: "message",
    label: "Message",
    navLabel: "Message",
    description: "Write, save, and reload campaign-specific email messages.",
  },
  {
    id: "audience",
    label: "Audience",
    navLabel: "Audience",
    description: "Import campaign recipients, dedupe, and apply suppressions.",
  },
  {
    id: "delivery",
    label: "Delivery",
    navLabel: "Delivery",
    description: "Set sender identity, SMTP settings, limits, and password flow.",
  },
  {
    id: "final",
    label: "Final Check",
    navLabel: "Final Check",
    description: "Check login, send a live test, and launch the campaign.",
  },
  {
    id: "hygiene",
    label: "Hygiene",
    navLabel: "Hygiene",
    description: "Import bounces, export suppressions, and search blocked addresses.",
  },
  {
    id: "logs",
    label: "Logs",
    navLabel: "Logs",
    description: "Review delivery failures and recent sender activity.",
  },
];

function compactNumber(value?: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

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
  const processed = (currentCampaign.sent || 0) + (currentCampaign.failed || 0);
  const progress = currentCampaign.total
    ? Math.min(100, (processed / currentCampaign.total) * 100)
    : 0;
  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];

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
    <section className="module-app">
      <aside className="module-sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">PP</span>
          <div>
            <strong>Purple Prices</strong>
            <span>Email Console</span>
          </div>
        </div>

        <a className="sidebar-home-link" href="/">
          Back to Purplestreet
        </a>

        <nav className="sidebar-nav" role="tablist" aria-label="Campaign workflow">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              aria-controls={`workflow-panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              className={`sidebar-nav-link ${activeTab === tab.id ? "active" : ""}`}
              id={`workflow-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              <span>{tab.navLabel}</span>
            </button>
          ))}
        </nav>

        <button className="sidebar-primary-action" onClick={() => setActiveTab("desk")} type="button">
          <span aria-hidden="true">+</span>
          New campaign
        </button>
      </aside>

      <div className="module-main">
        <header className="module-topbar">
          <div className="topbar-search" aria-label="Current module">
            <span className="topbar-search-icon" aria-hidden="true" />
            <span>Purple Prices campaign control</span>
          </div>
          <nav className="topbar-links" aria-label="Quick sections">
            {tabs.slice(0, 4).map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.navLabel}
              </button>
            ))}
          </nav>
          <div className="topbar-actions">
            <span className="status-pill">{currentCampaign.status || "Ready"}</span>
          </div>
        </header>

        <div className="module-scroll">
          <div className="module-content">
            <div className="module-title-row">
              <div>
                <p className="section-step">Purple Prices Email</p>
                <h1>{currentTab.label}</h1>
                <p className="lede">{currentTab.description}</p>
              </div>
              <div className="module-title-actions">
                <button className="action-link ghost button-like" onClick={() => setActiveTab("hygiene")} type="button">
                  Hygiene
                </button>
                <button className="action-link button-like" onClick={() => setActiveTab("final")} type="button">
                  Final check
                </button>
              </div>
            </div>

            <section className="campaign-command-grid">
              <article className="campaign-command-card wide">
                <div className="campaign-command-head">
                  <div>
                    <span>Current campaign</span>
                    <strong>{currentCampaign.subject || draft.campaignName || "Untitled campaign"}</strong>
                  </div>
                  <small>{processed ? `${compactNumber(processed)} processed` : "Draft not sent yet"}</small>
                </div>
                <div className="hero-progress-track" aria-hidden="true">
                  <span className="hero-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </article>
              <article className="campaign-command-card">
                <span>Sent</span>
                <strong>{compactNumber(currentCampaign.sent)}</strong>
              </article>
              <article className="campaign-command-card">
                <span>Failed</span>
                <strong>{compactNumber(currentCampaign.failed)}</strong>
              </article>
              <article className="campaign-command-card">
                <span>Remaining</span>
                <strong>{compactNumber(remaining)}</strong>
              </article>
              <article className="campaign-command-card">
                <span>Suppressions</span>
                <strong>{compactNumber(suppressions.length)}</strong>
              </article>
            </section>

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
          </div>
        </div>
      </div>
    </section>
  );
}
