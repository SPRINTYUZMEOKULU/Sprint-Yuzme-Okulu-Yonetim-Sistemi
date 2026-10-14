# Attendance background job

Endpoint: `/api/cron/attendance-notifications`.

The implementation is deployed but the schedule is deliberately inactive until project management access is restored and the account's cron interval limit is verified. No claim of active background scheduling should be made before a successful authenticated invocation and scheduler execution are observed.

Activation:
1. Reconnect Vercel to the owner of `sprintyuzmeokulus-projects`, project `sprint-yuzme-okulu-yonetim-sistemi`.
2. Verify that five-minute cron is supported on the current plan. Do not upgrade billing automatically.
3. Set a newly generated random `CRON_SECRET` of at least 32 characters in the production environment. Never put it in source control, URLs or logs.
4. Merge `attendance-cron.vercel.json` into the root `vercel.json` and redeploy.
5. Confirm that missing/invalid authorization returns 401, or 503 if the job is unconfigured.
6. Run an authenticated production check. Confirm that cancelled and fully recorded sessions generate zero alerts and that resolved alerts stay closed.
7. Verify the first scheduled execution and then perform a closed-app test on an authorized user's device.

The runner uses Istanbul dates and existing notification routing and push subscriptions. It excludes inactive schedules, passive students, pending starts and cancelled students. It supports partial attendance and groups sharing a time slot.

Concurrent scheduler and interactive generation use the service-only `attendance_notification_claims` primary key (organization + schedule + date). Existing attendance notification history is seeded into claims. A failed notification insert releases only its own claim token. A successful notification remains claimed even after reading/dismissing it.
