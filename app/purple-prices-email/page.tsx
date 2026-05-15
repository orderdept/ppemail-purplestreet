const stats = [
  { label: "Module", value: "Purple Prices Email" },
  { label: "Hostname", value: "ppemail.purplestreet.com" },
  { label: "Mail identity", value: "support@purpleprices.com" },
  { label: "Status", value: "Hosted rebuild in progress" },
];

const milestones = [
  "Preserve current Purple Prices behavior while hosted rebuild is developed separately.",
  "Rebuild suppressions, templates, campaign queue, and inbox cleanup on Convex.",
  "Protect the hosted app with Cloudflare Access rather than app-managed passwords.",
  "Do not cut over live sending until hosted dry runs and scheduling are verified.",
];

export default function PurplePricesEmailPage() {
  return (
    <main className="shell">
      <div className="page-top">
        <div>
          <p className="eyebrow">Purple Street Panel</p>
          <h1>Purple Prices Email</h1>
          <p className="lede">
            This is the hosted migration target for the Purple Prices email
            control panel. The local sender stays live until the hosted module
            is rebuilt and approved.
          </p>
        </div>
        <div className="status-pill">Opened from Purplestreet</div>
      </div>

      <section className="stat-grid">
        {stats.map((item) => (
          <article className="stat-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel wide">
          <h2>Migration guardrails</h2>
          <ul className="plain-list">
            {milestones.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h2>Hosted responsibilities</h2>
          <ul className="plain-list">
            <li>campaign queue</li>
            <li>suppression management</li>
            <li>saved templates</li>
            <li>bounce cleanup</li>
            <li>unsubscribe filing</li>
            <li>scheduled batches</li>
          </ul>
        </article>

        <article className="panel">
          <h2>Next implementation steps</h2>
          <ul className="plain-list">
            <li>Convex schema and seed module setup</li>
            <li>hosted UI shell and module navigation</li>
            <li>campaign state migration model</li>
            <li>Cloudflare Access deployment wiring</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
