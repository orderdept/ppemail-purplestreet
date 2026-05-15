import Link from "next/link";

import {
  compactNumber,
  formatDateTime,
  formatRate,
  getPurplePricesData,
} from "../../lib/purple-prices-data";
import { CampaignWorkspace } from "./campaign-workspace";
import { ImportBouncesButton } from "./import-bounces-button";
import { TemplateManager } from "./template-manager";

export const dynamic = "force-dynamic";

export default async function PurplePricesEmailPage() {
  const data = await getPurplePricesData();
  const campaign = data.latestCampaign;
  const template = data.latestTemplate;
  const remaining = Math.max(
    0,
    (campaign?.total || 0) - (campaign?.sent || 0) - (campaign?.failed || 0),
  );

  return (
    <main className="shell">
      <div className="page-top">
        <div>
          <p className="eyebrow">Purplestreet / Purple Prices</p>
          <h1>Purple Prices Email</h1>
          <p className="lede">
            Purple Prices is now living on PS in earnest. The hosted panel is
            carrying the real suppression list, saved messages, campaign setup,
            and the finished campaign history while we move the live sender
            across piece by piece.
          </p>
        </div>
        <div className="status-pill">Hosted on PS</div>
      </div>

      <section className="stat-grid stat-grid-six">
        <article className="stat-card">
          <span>From name</span>
          <strong>{data.senderName}</strong>
        </article>
        <article className="stat-card">
          <span>Sender email</span>
          <strong>{data.senderEmail}</strong>
        </article>
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
          <span>Suppressions</span>
          <strong>{compactNumber(data.suppressions.length)}</strong>
        </article>
      </section>

      <CampaignWorkspace draft={data.draft} suppressions={data.suppressions} />

      <section className="content-grid">
        <article className="panel wide">
          <div className="module-row">
            <div>
              <h2>Latest campaign snapshot</h2>
              <p>
                Last subject: <strong>{campaign?.subject || "—"}</strong>
              </p>
            </div>
            <Link className="action-link subtle-link" href="/">
              Back to PS
            </Link>
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
              <span>Completed</span>
              <strong>{formatDateTime(campaign?.completedAt)}</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <h2>Suppression list</h2>
          <p>{compactNumber(data.suppressions.length)} addresses carried over.</p>
          <div className="button-row">
            <ImportBouncesButton />
          </div>
          <div className="button-row">
            <a className="action-link" href="/api/purple-prices/suppressions/export.csv">
              Download CSV
            </a>
            <a className="action-link ghost" href="/api/purple-prices/suppressions/export.json">
              Download JSON
            </a>
          </div>
          <div className="pill-list">
            {data.suppressions.slice(0, 18).map((email) => (
              <span className="email-pill" key={email}>
                {email}
              </span>
            ))}
          </div>
        </article>

        <TemplateManager
          initialTemplate={template}
          templates={data.templates}
        />

        <article className="panel">
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
          <h2>Recent activity</h2>
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
