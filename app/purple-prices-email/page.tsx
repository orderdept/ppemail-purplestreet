import Link from "next/link";

import {
  compactNumber,
  formatDateTime,
  formatRate,
  getPurplePricesData,
} from "../../lib/purple-prices-data";
import { CampaignWorkspace } from "./campaign-workspace";
import { CampaignDesk } from "./campaign-desk";
import { ImportBouncesButton } from "./import-bounces-button";
import { SuppressionSearch } from "./suppression-search";
import { TemplateManager } from "./template-manager";

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

      <CampaignDesk draft={data.draft} campaigns={data.campaigns} />

      <TemplateManager draft={data.draft} templates={data.templates} />

      <CampaignWorkspace
        draft={data.draft}
        suppressions={data.suppressions}
        templateName={data.draft.draftMessageName || null}
      />

      <section className="content-grid">
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
              <strong>{compactNumber(campaign?.total)}</strong>
            </div>
            <div className="detail-item">
              <span>Remaining</span>
              <strong>{compactNumber(remaining)}</strong>
            </div>
            <div className="detail-item">
              <span>Daily limit</span>
              <strong>{compactNumber(campaign?.dailyLimit)}</strong>
            </div>
            <div className="detail-item">
              <span>Send rate</span>
              <strong>{formatRate(campaign?.intervalMs)}</strong>
            </div>
            <div className="detail-item">
              <span>Batches</span>
              <strong>
                {campaign?.currentBatch || 0}/{campaign?.totalBatches || 0}
              </strong>
            </div>
            <div className="detail-item">
              <span>Last completed send</span>
              <strong>{formatDateTime(latestCampaign?.completedAt)}</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <p className="section-step">List hygiene</p>
          <h2>Suppressions</h2>
          <p>{compactNumber(data.suppressions.length)} addresses are excluded from future sends.</p>
          <div className="button-row">
            <ImportBouncesButton
              campaignSubject={latestCampaign?.subject || ""}
              smtpUsername={data.draft.smtpUsername}
            />
          </div>
          <div className="button-row">
            <a className="action-link" href="/api/purple-prices/suppressions/export.csv">
              Download CSV
            </a>
            <a className="action-link ghost" href="/api/purple-prices/suppressions/export.json">
              Download JSON
            </a>
          </div>
          <SuppressionSearch suppressions={data.suppressions} />
        </article>

        <article className="panel">
          <p className="section-step">Delivery watch</p>
          <h2>Recent failed deliveries</h2>
          {data.recentFailures.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentFailures.map((row) => (
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
            {data.recentLog.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
