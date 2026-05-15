import Link from "next/link";

import {
  compactNumber,
  formatDateTime,
  getPurplePricesData,
} from "../lib/purple-prices-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getPurplePricesData();
  const latestCampaign = data.latestCampaign;

  return (
    <main className="shell">
      <div className="page-top">
        <div>
          <p className="eyebrow">Purplestreet</p>
          <h1>Control Panels</h1>
          <p className="lede">
            Your private control surface on PS. Purple Prices Email is now
            carrying over the live data from the local panel, including the
            current suppression list and completed campaign history.
          </p>
        </div>
        <div className="status-pill">Cloudflare Access protected</div>
      </div>

      <section className="stat-grid">
        <article className="stat-card">
          <span>Module</span>
          <strong>{data.moduleName}</strong>
        </article>
        <article className="stat-card">
          <span>Campaign status</span>
          <strong>{latestCampaign?.status || "Ready"}</strong>
        </article>
        <article className="stat-card">
          <span>Suppressions</span>
          <strong>{compactNumber(data.suppressions.length)}</strong>
        </article>
        <article className="stat-card">
          <span>Last completed</span>
          <strong>{formatDateTime(latestCampaign?.completedAt)}</strong>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel wide">
          <div className="module-row">
            <div>
              <h2>Purple Prices Email</h2>
              <p>
                Mail identity stays on <code>purpleprices.com</code>. PS is the
                hosted admin home.
              </p>
            </div>
            <Link className="action-link" href="/purple-prices-email">
              Open panel
            </Link>
          </div>
        </article>

        <article className="panel">
          <h2>Last campaign</h2>
          <p>
            {compactNumber(latestCampaign?.sent)} sent,{" "}
            {compactNumber(latestCampaign?.failed)} failed,{" "}
            {compactNumber(
              Math.max(
                0,
                (latestCampaign?.total || 0) -
                  (latestCampaign?.sent || 0) -
                  (latestCampaign?.failed || 0),
              ),
            )}{" "}
            remaining.
          </p>
        </article>

        <article className="panel">
          <h2>Suppression exports</h2>
          <p>Download the current list anytime for website/account cleanup.</p>
        </article>
      </section>
    </main>
  );
}
