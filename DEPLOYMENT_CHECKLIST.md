# Deployment Checklist

## Accounts already confirmed

- GitHub
- Vercel
- Convex
- Cloudflare

## DNS target

- `ppemail.purplestreet.com`

## Initial deployment sequence

1. Create GitHub repo for `ppemail-purplestreet`
2. Push this project into that repo
3. Import repo into Vercel
4. Create Convex project for this panel
5. Add Convex environment values to Vercel
6. Add DNS record for `ppemail.purplestreet.com`
7. Put Cloudflare Access in front of the hostname
8. Verify hosted shell loads behind Access

## Before live cutover

- hosted campaign state works
- hosted suppressions work
- hosted template storage works
- hosted scheduling works
- hosted bounce cleanup works
- hosted unsubscribe reply filing works
- SMTP/IMAP credentials are configured outside the local Mac flow

## Keep local sender untouched until

- hosted dry runs are clean
- test sends are clean
- scheduled batches are verified
- you explicitly approve the switch

## Contact-list containment

- Static contact-list exports are removed; suppression CSV/JSON API downloads return 410 without reading operational data.
- Local sync copies operational suppression data only into server-side `data/purple-prices`; it must never recreate public exports.
- Run the public export guard before every build (included in `prebuild`). Keep operational files out of client imports and public assets.
- Verify anonymous requests to both former static paths and both API download paths after deployment.
- The email panel still serializes suppression/draft data to its viewer, and the customer-orders API returns customer records. Full origin authentication is a separate unresolved requirement; Cloudflare Access on the custom hostname alone does not protect direct Vercel URLs.

The unused `/purple-prices-email` and `/pep-customers` panels and orders GET/HEAD
are retired with data-free HTTP 410 responses. Historical implementation and
records remain intact. Agent campaign scripts use private local files/direct
Convex access; Hostcats unsubscribe POST bridge remains available. This narrow
containment does not add authentication to other legacy mutation APIs, which
must be assessed separately before any further panel retirement or migration.
