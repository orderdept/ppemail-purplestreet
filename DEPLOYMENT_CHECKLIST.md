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
