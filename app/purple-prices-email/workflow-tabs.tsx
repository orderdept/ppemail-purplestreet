"use client";

import { useEffect, useState } from "react";

import { type CampaignDraft, type SavedTemplate } from "../../lib/purple-prices-types";
import { CampaignDesk } from "./campaign-desk";
import { CampaignWorkspace } from "./campaign-workspace";
import { TemplateManager } from "./template-manager";

type WorkflowTab = "desk" | "message" | "audience" | "delivery" | "final";

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
  suppressions: string[];
  templates: SavedTemplate[];
};

const tabStorageKey = "purple-prices-workflow-tab";

const tabs: Array<{ id: WorkflowTab; label: string }> = [
  { id: "desk", label: "Campaign Desk" },
  { id: "message", label: "Message" },
  { id: "audience", label: "Audience" },
  { id: "delivery", label: "Delivery" },
  { id: "final", label: "Final Check" },
];

export function WorkflowTabs({ campaigns, draft, suppressions, templates }: Props) {
  const [activeTab, setActiveTab] = useState<WorkflowTab>("desk");

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
        <CampaignWorkspace
          activeStep="final"
          draft={draft}
          suppressions={suppressions}
          templateName={draft.draftMessageName || null}
        />
      </div>
    </section>
  );
}
