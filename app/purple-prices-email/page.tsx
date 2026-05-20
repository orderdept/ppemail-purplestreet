import Link from "next/link";

import {
  compactNumber,
  formatDateTime,
  formatRate,
  getPurplePricesData,
} from "../../lib/purple-prices-data";
import { WorkflowTabs } from "./workflow-tabs";

export const dynamic = "force-dynamic";

export default async function PurplePricesEmailPage() {
  const data = await getPurplePricesData();
  const draftCampaign = data.currentDraftCampaign;
  const latestCampaign = data.latestCampaign;
  const campaign = draftCampaign;
  const remaining = Math.max(
    0,
    (campaign?.total || 0) - (campaign?.sent || 0) - (campaign?.failed || 0),
  );

  return (
    <main className="shell">
      <div className="page-top">
        <div>
          <p className="eyebrow">Purplestreet / Campaign Control</p>
          <h1>Purple Prices Email</h1>
          <p className="lede">
            Plan a campaign, keep the audience clean, test delivery, and keep a
            close eye on results from one place.
          </p>
        </div>
        <div className="page-top-actions">
          <div className="status-pill">{campaign?.status || "Ready"}</div>
          <Link className="action-link ghost subtle-link" href="/">
            Back to PS
          </Link>
        </div>
      </div>

      <section className="hero-band">
        <div className="hero-band-copy">
          <div className="hero-label-row">
            <span className="hero-kicker">Current campaign</span>
            <span className="hero-inline-meta">
              {campaign?.subject || "No subject yet"}
            </span>
          </div>
          <div className="hero-progress-row">
            <div className="hero-progress-track" aria-hidden="true">
              <span
                className="hero-progress-fill"
                style={{
                  width: `${campaign?.total ? Math.min(100, (((campaign?.sent || 0) + (campaign?.failed || 0)) / campaign.total) * 100) : 0}%`,
                }}
              />
            </div>
            <strong className="hero-progress-caption">
              {campaign?.total
                ? `${compactNumber((campaign?.sent || 0) + (campaign?.failed || 0))} of ${compactNumber(campaign.total)} processed`
                : "No campaign history yet"}
            </strong>
          </div>
        </div>
        <div className="hero-metrics">
          <div className="hero-metric">
            <span>Sender</span>
            <strong>{data.draft.fromName}</strong>
            <small>{data.draft.smtpUsername}</small>
          </div>
          <div className="hero-metric">
            <span>Completed</span>
            <strong>{formatDateTime(campaign?.completedAt)}</strong>
            <small>{campaign?.completedAt ? "Last finished run" : "Nothing sent yet"}</small>
          </div>
        </div>
      </section>

      <section className="stat-grid stat-grid-six">
        <article className="stat-card">
          <span>Campaign status</span>
          <strong>{campaign?.status || "Ready"}</strong>
        </article>
        <article className="stat-card">
          <span>Sent</span>
          <strong>{compactNumber(campaign?.sent)}</strong>
        </article>
        <article className="stat-card">
          <span>Failed</span>
          <strong>{compactNumber(campaign?.failed)}</strong>
        </article>
        <article className="stat-card">
          <span>Remaining</span>
          <strong>{compactNumber(remaining)}</strong>
        </article>
        <article className="stat-card">
          <span>Suppressions</span>
          <strong>{compactNumber(data.suppressions.length)}</strong>
        </article>
        <article className="stat-card">
          <span>Send rate</span>
          <strong>{formatRate(campaign?.intervalMs)}</strong>
        </article>
      </section>

      <WorkflowTabs
        campaigns={data.campaigns}
        currentCampaign={campaign}
        draft={data.draft}
        latestCampaign={latestCampaign}
        recentFailures={data.recentFailures}
        recentLog={data.recentLog}
        suppressions={data.suppressions}
        templates={data.templates}
      />
    </main>
  );
}
