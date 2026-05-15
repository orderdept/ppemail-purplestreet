export default function HomePage() {
  return (
    <main className="shell">
      <div className="page-top">
        <div>
          <p className="eyebrow">Purple Street Control Panel</p>
          <h1>PP Email</h1>
          <p className="lede">
            Hosted rebuild in progress for the Purple Prices email control
            panel. This project is being migrated separately so the live local
            sender can continue running without interference.
          </p>
        </div>
        <div className="status-pill">Separate hosted repo</div>
      </div>

      <section className="content-grid">
        <article className="panel wide">
          <h2>First module</h2>
          <p>
            Purple Prices email will be the first hosted control panel under
            the `purplestreet.com` private admin domain system.
          </p>
          <a className="panel-link" href="/purple-prices-email">
            Open Purple Prices Email
          </a>
        </article>

        <article className="panel">
          <h2>Hostname</h2>
          <p>`ppemail.purplestreet.com`</p>
          <p>Purple Prices identity remains on `purpleprices.com`.</p>
        </article>

        <article className="panel">
          <h2>Access model</h2>
          <p>Cloudflare Access in front of the app.</p>
          <p>No app-managed password system required in v1.</p>
        </article>
      </section>
    </main>
  );
}
