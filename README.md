# PP Email Hosted

Hosted Purple Prices email control panel for `ppemail.purplestreet.com`.

This project is intentionally separate from the live local sender in `/Volumes/MyM4 Ext Drive/Documents/Programs/Purple Peps`. The local app remains the active operational system until the hosted rebuild is fully tested and you decide to switch.

## Confirmed decisions

- hostname: `ppemail.purplestreet.com`
- source control: separate repo
- frontend hosting: Vercel
- backend/state/jobs: Convex
- DNS and access: Cloudflare
- login gate: Cloudflare Access

## What this project is for

- Purple Prices email control panel only
- hosted UI and backend rebuild
- future-safe migration target
- no interference with the current local sending workflow

## What this project is not

- not the currently live sender
- not yet the source of live SMTP sends
- not a shared multi-panel umbrella app for every future tool

Other tools can follow the same pattern later under their own `*.purplestreet.com` names.

## Current implementation status

- separate hosted project scaffold created
- Next.js app shell created
- first module route created for Purple Prices email
- Convex backend folder scaffold created
- deployment/env checklist created

## Recommended access model

Cloudflare Access will be the login gate in front of the hosted app.

Why this is the simplest first version:

- no custom password system in the app
- no app-managed session logic needed on day one
- reusable for future panels
- matches the idea of `purplestreet.com` as your private control-panel domain

## Migration guardrails

- do not modify the current local sender while scheduled emails are active there
- do not point production DNS at the hosted rebuild until tested
- do not cut over SMTP/IMAP processing until hosted sending, scheduling, suppressions, and inbox cleanup are verified

## Build phases

1. create hosted app shell
2. model backend state in Convex
3. rebuild Purple Prices module UI
4. rebuild scheduling and suppression flows
5. wire Cloudflare Access
6. dry-run hosted workflows
7. cut over only when approved
