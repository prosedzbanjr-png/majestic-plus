# Majestic+ FiveM Control Plane V1

Contract version: `1`

Majestic+ Vercel is the control plane. It validates account linking, subscription plans, purchase settlement state, My List, entitlement and YouTube playback authorization. It is **not** the ESX money authority, LB-Phone authority or a video proxy.

## Authentication

The existing catalog routes are public browse-only endpoints:

- `GET /api/v1/fivem/catalog`
- `GET /api/v1/fivem/catalog/search`
- `GET /api/v1/fivem/titles/{slug}`

Every private machine endpoint below requires:

`Authorization: Bearer <MAJESTIC_FIVEM_API_KEY>`

Machine auth is evaluated before request-body parsing. Responses include a correlation ID. The API never returns raw ESX subjects, subject hashes, Supabase credentials, app metadata or auth tokens.

## Account

### `POST /api/v1/fivem/account/link/confirm`

Input:

```json
{ "username": "viewer", "code": "48291374", "phone": "5551234", "subject": "<opaque>" }
```

The backend validates the stateless website challenge, derives `subject_hash = HMAC-SHA256(MAJESTIC_LINK_SECRET, "subject:v1|realm|subject")`, checks account/identity/phone conflicts and merges only `app_metadata.majestic_fivem` while preserving all unrelated app metadata.

### `POST /api/v1/fivem/account/resolve`

Input:

```json
{ "phone": "5551234", "subject": "<opaque>" }
```

Returns a narrow linked-account DTO with masked phone and read-only subscription projection. A subject match with a different stored phone returns `PHONE_CHANGED`.

### Website session routes

- `POST /api/account/fivem-link/challenge`
- `POST /api/account/fivem-link/unlink`

Challenge identity comes from the existing viewer session. Browser input never supplies a user ID. Pairing codes are stateless and approximately five minutes old at expiry.

## Subscription plans

### `POST /api/v1/fivem/subscription/plans`

Returns only active plans from `majestic_subscription_plans` using the authoritative database price, currency and duration.

Example item:

```json
{
  "code": "premiere",
  "name": "Premiere",
  "price": 149,
  "currency": "USD",
  "billingDays": 30,
  "maxDevices": 4,
  "quality": "4K",
  "features": []
}
```

FiveM must never submit or dictate a price.

## Zero-schema ESX settlement

FiveM purchases use existing `majestic_transactions` and `majestic_subscriptions`. They never call `purchase_majestic_subscription()` and never mutate `majestic_wallets`.

Stable operation reference:

`fivem:<realm>:subscription:<operationId>`

### PREPARE

`POST /api/v1/fivem/subscription/purchase/prepare`

Input:

```json
{ "phone": "5551234", "subject": "<opaque>", "planCode": "premiere", "operationId": "<uuid>" }
```

PREPARE resolves the linked account and active plan, reads the authoritative price and creates a temporary `failed` transaction containing a bounded versioned internal marker. This is a zero-schema representation of a prepared operation; no wallet or ESX debit occurs on Vercel.

### COMMIT

`POST /api/v1/fivem/subscription/purchase/commit`

Input contains only `phone`, `subject` and `operationId`.

Flow:

1. Load the prepared transaction.
2. Calculate the exact target subscription end.
3. Persist internal state `applying` with that target.
4. Upsert `majestic_subscriptions` with `payment_source = "fivem_esx"`, `auto_renew = false`.
5. Mark the transaction `completed` and replace the internal marker with a normal viewer-facing description.

An active future subscription is extended from its current period end. Expired/new subscriptions start from now. If a newer extension is observed before this operation is applied, it is preserved and this billing period is added on top.

Crash/retry behavior:

- before `applying`: retry recalculates the operation;
- after `applying`, before subscription write: retry uses/reconciles the stored target;
- after subscription write, before transaction completion: retry detects the target already applied and finalizes the transaction;
- repeated completed COMMIT returns idempotent success and does not extend again.

### CANCEL

`POST /api/v1/fivem/subscription/purchase/cancel`

Allowed reasons: `DEBIT_FAILED`, `COMPENSATED`, `ABORTED`.

Prepared/unapplied operations become internal `cancelled` state. Completed/applied operations are never shortened or deleted. CANCEL is idempotent.

### Zero-schema concurrency limitation

`majestic_transactions.external_reference` does not have a database UNIQUE constraint and schema changes are intentionally forbidden for this MVP. The backend performs application pre-checks and strict retry/idempotency checks, but simultaneous cross-Vercel-instance races cannot be mathematically guaranteed absent a database uniqueness constraint. The FiveM resource must serialize purchase operations per player/operation ID.

## My List

- `POST /api/v1/fivem/my-list/list`
- `POST /api/v1/fivem/my-list/set`

Both resolve the linked canonical `auth.users.id`. `set` accepts a production `slug` and boolean `saved`; the backend resolves the production UUID server-side and performs idempotent add/remove operations on `majestic_my_list`.

## Playback authorization

### `POST /api/v1/fivem/playback/authorize`

Movie target:

```json
{ "phone": "5551234", "subject": "<opaque>", "target": { "kind": "movie", "slug": "space-trip" } }
```

Episode target:

```json
{ "phone": "5551234", "subject": "<opaque>", "target": { "kind": "episode", "episodeId": "<uuid>" } }
```

Authorization requires a linked account, an active non-expired subscription, published content and an authoritative `youtube_id`. The response returns only the provider, kind, video ID and narrow title/episode metadata. Video bytes never pass through Vercel; FiveM NUI embeds YouTube directly later.

## Stable errors

At minimum:

`UNAUTHORIZED`, `INVALID_REQUEST`, `RATE_LIMITED`, `ACCOUNT_NOT_LINKED`, `PHONE_CHANGED`, `ACCOUNT_ALREADY_LINKED`, `IDENTITY_ALREADY_LINKED`, `PHONE_ALREADY_LINKED`, `LINK_INVALID`, `PLAN_NOT_FOUND`, `SUBSCRIPTION_REQUIRED`, `OPERATION_NOT_FOUND`, `OPERATION_CANCELLED`, `OPERATION_ALREADY_COMMITTED`, `PURCHASE_CONFLICT`, `CONTENT_UNAVAILABLE`, `PLAYBACK_UNAVAILABLE`, `INTERNAL_ERROR`.

Internal Supabase/database errors are not returned to machine clients.

## Auth scanning scale limit

Zero-schema account linking currently scans Supabase Auth Admin users with bounded pagination: at most 20 pages × 100 users (2,000 users) per resolution/conflict scan. Correctness does not depend on an in-memory cache. If the viewer population exceeds that bound, a later persistence/indexing decision will be required.

## Deferred feature

Watch progress / Continue Watching is intentionally outside Control Plane V1 because the existing zero-schema database has no proper progress table. It must not be stored in app metadata, transactions or My List.
