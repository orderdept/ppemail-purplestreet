# Architecture

## Domain model

- Hosted control panel URL: `ppemail.purplestreet.com`
- Business identity managed by this module: `support@purpleprices.com`
- Control-panel domain and email domain remain intentionally separate

## System boundaries

### Existing local system

- Local UI and Python backend in `Purple Peps`
- Active SMTP sending
- Active IMAP cleanup
- Active scheduled batches

This remains untouched during the hosted rebuild.

### New hosted system

- Separate repo
- Separate deployment target
- Separate backend state
- Separate credentials configuration

The hosted system starts as a non-live rebuild until verified.

## Hosted responsibilities

- contact import
- dedupe
- suppression management
- saved messages/templates
- SMTP configuration management
- test sends
- scheduled batch execution
- bounce processing
- delayed notice filing
- unsubscribe reply processing

## Proposed hosted split

### Vercel

- app shell
- panel pages
- module navigation
- frontend interactions

### Convex

- contacts and imports
- suppressions
- templates
- campaign records
- send queue state
- scheduled batch jobs
- inbox cleanup job metadata

### Cloudflare

- DNS for `ppemail.purplestreet.com`
- access protection for private login
- optional WAF/rules

## Auth recommendation

Preferred first version: Cloudflare Access in front of the app.

Fallback if you want app-native auth later:

- magic link
- email/password

## Hosted module scope

This repo is only for the Purple Prices email module. Other control panels should get their own repos or clearly separated apps later.
