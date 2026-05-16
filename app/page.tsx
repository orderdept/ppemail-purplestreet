import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="shell">
      <div className="page-top">
        <div>
          <p className="eyebrow">Purplestreet</p>
          <h1>Control Panels</h1>
          <p className="lede">
            Your private control surface on PS. Open a panel to work inside that
            module.
          </p>
        </div>
        <div className="status-pill">Cloudflare Access protected</div>
      </div>

      <section className="content-grid">
        <article className="panel wide">
          <div className="module-row">
            <div>
              <p className="section-step">Panel</p>
              <h2>Purple Prices Email</h2>
            </div>
            <Link className="action-link" href="/purple-prices-email">
              Open panel
            </Link>
          </div>
        </article>

        <article className="panel wide">
          <div className="module-row">
            <div>
              <p className="section-step">Panel</p>
              <h2>BarePlay</h2>
            </div>
            <Link
              className="action-link"
              href="https://bareplay-purplestreet.vercel.app/bareplay-email"
            >
              Open panel
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
