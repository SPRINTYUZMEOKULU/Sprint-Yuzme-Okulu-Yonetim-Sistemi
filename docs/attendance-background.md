# Scheduled integration checks

The production endpoint is `/api/cron/attendance-notifications`. It requires a server-side bearer secret. Only this exact path bypasses the cookie-login middleware; the handler still rejects missing/invalid authorization. `?check=1` verifies authentication without updating counters or producing notifications.

The scheduler uses the existing Supabase pg_cron instance and pg_net, so no Vercel cron-frequency upgrade is required. The five-minute job is `sprint-background-notifications`. Its stored command calls `private.enqueue_sprint_background()`; it contains no credential. The enqueuer retrieves its dedicated secret from Vault and sends it as an Authorization header to the fixed production host. CRON_SECRET is a Production Secret in the intended Vercel project. Never print either value or put it in a URL, source file, report or build log.

The migration creates the job **inactive**. After deploying the endpoint:

1. Verify unauthorized requests return 401; unconfigured jobs return 503.
2. Use the dedicated secret for an authenticated `?check=1` request. It must return `{ok:true,check:true}` without sending anything.
3. Enqueue one production run and inspect only status/count fields from `net._http_response` using the request ID recorded in `private.sprint_background_requests`.
4. Enable the job only after a successful response. Observe a successful scheduled invocation as well; enqueuing alone does not prove delivery.

Each execution first uses the existing `sync_scheduled_used_lessons` engine, then runs attendance and registration notification checks. It does not create payments, registration packages, approvals or historical attendance rows. Counters and elapsed makeup statuses follow the existing school rules. Notification routing, subscriptions and existing deduplication claims are reused.

A daily midnight-Turkey renewal activation job remains separate and is preserved.

`Ayarlar → Sistem Kontrolü` reads the service-only `sprint_system_integration_health` RPC. It shows current registration/plan/link/counter checks, missing legacy makeup plans, manual approval backlog and the latest HTTP scheduler result. Missing or stale results are not marked healthy. The page itself performs no repairs or messaging. Device delivery still requires an installed/supported app, notification permission and a real-device test.

To pause background work, disable only the named pg_cron job. Do not remove the renewal activation job or rotate shared keys. The older `attendance-cron.vercel.json` is an unused sample; adding it would create a second scheduler and is unnecessary for this deployment.
