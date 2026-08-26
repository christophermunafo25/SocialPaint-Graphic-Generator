# Public links: what is recorded about a visitor

**For the privacy policy (prompt 10).** Public template links are the only
part of the product that collects anything from a person who is not a
customer's member, so this is the section that has to be written down rather
than inferred from the code.

The short version: we count events, not people. There is no visitor identity
anywhere in this feature, and building one would be a product decision
requiring disclosure — not something that could arrive as an implementation
detail.

## What is stored

| Where | What | Retention | Why |
|---|---|---|---|
| `usage_events` | One row per open and per export: the company, the template, the link, `actor = 'public'`, a timestamp. **No `user_id`.** | With the tenant's usage history | So the admin who sent the link can see it working |
| `template_links.use_count`, `.last_used_at` | A counter and a timestamp | Life of the link | The open cap, and the admin's "is this live" answer |
| `rate_limit_counters` | `sha256(pepper + IP)`, truncated, plus a window and a count | **24 hours**, swept automatically | The endpoint is unauthenticated; without a limiter it is a scraping target |
| The visitor's own browser | Text and select values they typed, in `localStorage` | 7 days, or until they export | Closing the tab should not lose their work |

## What is deliberately NOT stored

- **No visitor identity of any kind.** No cookie, no device id, no
  fingerprint, no session, no account, no email capture, no sign-up prompt.
- **No raw IP address.** The rate limiter stores a peppered digest and
  nothing else, so the table cannot be joined back to a person or turned
  into an identity graph. The pepper (`PUBLIC_LINK_IP_PEPPER`) is
  server-side only.
- **No uploaded photo.** A photo a visitor adds is cropped in their own
  browser to a data URL and goes straight into their PNG. It never reaches
  our servers or storage, so there is nothing to retain, leak, or delete.
- **No content of the fill.** The name, talk title, or anything else they
  type is never sent anywhere. It lives in the page, in their browser, and
  in the PNG they download.
- **No referrer capture, and no token in a query string.** The token is in
  the URL path and travels to the endpoint in the request body, so it does
  not land in referrer headers or proxy access logs.

## What the customer's admin can see

The counts above, aggregated per template and per link: opens, exports, last
used. They cannot see who filled a link in, because nobody knows.

## If any of this changes

Anything that would let two events be attributed to the same person — a
cookie, a device id, a durable identifier of any kind — changes the answer
above and needs the privacy policy updated before it ships, not after.
