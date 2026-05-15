export default function HomePage() {
  return (
    <main className="shell">
      <div className="page-top">
        <div>
          <p className="eyebrow">Purple Street Control Panel</p>
          <h1>Purplestreet</h1>
          <p className="lede">
            Private home for your hosted control panels. The Purple Prices
            email panel is the first module, and the live local sender stays
            separate while the hosted version is rebuilt.
          </p>
        </div>
        <div className="status-pill">Cloudflare Access protected</div>
      </div>

      <section className="content-grid">
        <article className="panel wide">
          <h2>First module</h2>
          <p>
            Purple Prices email is the first hosted control panel inside the
            `purplestreet.com` private admin system.
          </p>
          <a className="panel-link" href="/purple-prices-email">
            Open Purple Prices Email
          </a>
        </article>

        <article className="panel">
          <h2>Panel identity</h2>
          <p>Purple Prices mail stays on `purpleprices.com`.</p>
          <p>This site is only the private control surface.</p>
        </article>

        <article className="panel">
          <h2>Access model</h2>
          <p>Login happens at `purplestreet.com`.</p>
          <p>Cloudflare Access handles the front door.</p>
        </article>
      </section>
    </main>
  );
}
