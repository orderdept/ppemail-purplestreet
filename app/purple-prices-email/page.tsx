import Link from "next/link";

import {
  compactNumber,
  formatDateTime,
  formatRate,
  getPurplePricesData,
} from "../../lib/purple-prices-data";

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
            Hosted control panel state for Purple Prices. This page now carries
            over the real suppression list, the saved message template, and the
            latest campaign record from the retired local panel.
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
          <h2>Saved message</h2>
          <p>{template?.name || "No saved message found."}</p>
          <div className="meta-stack">
            <div>
              <span>Subject</span>
              <strong>{template?.message.subject || "—"}</strong>
            </div>
            <div>
              <span>Inbox snippet</span>
              <strong>{template?.message.previewText || "—"}</strong>
            </div>
            <div>
              <span>Footer address</span>
              <strong className="multiline">
                {template?.message.mailingAddress || "—"}
              </strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <h2>Suppression list</h2>
          <p>{compactNumber(data.suppressions.length)} addresses carried over.</p>
          <div className="button-row">
            <a className="action-link" href={data.suppressionDownloads.csv}>
              Download CSV
            </a>
            <a className="action-link ghost" href={data.suppressionDownloads.json}>
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

        <article className="panel wide">
          <h2>Message body</h2>
          <pre className="message-block">{template?.message.body || "—"}</pre>
        </article>

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
