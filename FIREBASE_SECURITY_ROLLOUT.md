# Firebase Realtime Database security rollout

`firebase/database.rules.json` is a baseline for this app. It requires Firebase Authentication, constrains room IDs, and accepts only canonical schema v6 rooms.

Schema v6 adds a bounded operation-id journal (latest 256 operations) and `resetGeneration`. Replayed outbox operations are no-ops, while packets captured before a reset cannot recreate old participants. An unsent outbox expires after 24 hours; Rules-rejected outboxes are discarded immediately and shown in local sync diagnostics. A client that sees a newer schema refuses to write and asks for an app update. Rules reject v5 writers after the rollout.

It is intentionally **not deployed by this repository**. Deploying rules is an external production change and must be done after the checks below.

## Local Emulator verification

Run this before any staging or production deploy. It uses the demo-only project ID
`demo-circle-kikaku-tools`; it cannot contact a production Firebase project.

```powershell
# Firebase Emulator currently requires Java 21 or later.
npm run test:firebase:emulator
```

The test verifies authenticated normal create/read/update, five concurrent clients,
same-node transaction conflict retry, offline queued-write recovery, reset generation,
and Rules rejections for unauthenticated access, malformed room IDs, v5/invalid schema,
non-numeric timestamps, revision regression, malformed values, and tombstone resurrection.

## Optional staging Firebase browser test

This test refuses the configured production project and intercepts `firebase-config.js` with a staging-only config. It never falls back to the checked-in production config.

```powershell
$env:SANPO_LIVE_FIREBASE = '1'
$env:SANPO_STAGING_FIREBASE_CONFIG = '{"apiKey":"...","authDomain":"your-staging.firebaseapp.com","databaseURL":"https://your-staging-default-rtdb.firebaseio.com","projectId":"your-staging"}'
npm run test:collab:firebase
```

Use a separate Firebase project with Anonymous Authentication enabled and its own Realtime Database Rules deployed. This suite creates isolated timestamped rooms and uses five browser contexts.

## Before deployment

1. Confirm Anonymous Authentication is enabled in Firebase Authentication. The app signs users in anonymously before opening `rooms/{roomId}`.
2. Confirm every production room ID matches `^[A-Za-z0-9_-]{6,80}$`.
3. Run `npm run test:firebase:emulator` and resolve every failure.
4. Run `SANPO_LIVE_FIREBASE=1` with `SANPO_STAGING_FIREBASE_CONFIG` against an isolated staging Firebase project.
5. Back up the Realtime Database rules and data.
6. Deploy with Firebase CLI: `firebase deploy --only database`.

## Important limitation

Anonymous authentication proves only that the caller is a Firebase client. It does **not** make a room private: any anonymous client that knows a valid room ID can still access it under this baseline.

Private rooms need a separate access model before applying stricter rules: for example, authenticated organizer accounts plus room member records, or a backend that issues Firebase custom claims. Do not put a room password in Realtime Database rules or the URL and treat that as access control.

## Live collaboration test

The checked-in live test deliberately requires `SANPO_LIVE_FIREBASE=1` because it writes test rooms. Run it only against an authorized test project. CI always runs deterministic five-device simulations; production Firebase integration remains opt-in.
