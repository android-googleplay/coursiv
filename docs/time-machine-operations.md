# Time Machine operations

## Required App Hosting configuration

Set these server-only variables in Firebase App Hosting:

```text
FIREBASE_APP_HOSTING_PROJECT_ID
FIREBASE_APP_HOSTING_LOCATION
FIREBASE_APP_HOSTING_BACKEND_ID
TIME_MACHINE_SCHEDULER_AUDIENCE=https://YOUR_PRODUCTION_DOMAIN/api/internal/time-machine/daily
TIME_MACHINE_SCHEDULER_SERVICE_ACCOUNT_EMAIL=coursiv-time-machine-scheduler@PROJECT_ID.iam.gserviceaccount.com
```

The App Hosting runtime identity needs only:

```text
firebaseapphosting.builds.get
firebaseapphosting.builds.list
firebaseapphosting.rollouts.get
firebaseapphosting.rollouts.list
firebaseapphosting.rollouts.create
```

Do not grant the runtime identity access to user-data collections for this feature.

## Daily checkpoint

Create a dedicated service account and configure Cloud Scheduler to send an OIDC-authenticated `POST` once per day to:

```text
https://YOUR_PRODUCTION_DOMAIN/api/internal/time-machine/daily
```

Set the OIDC audience to exactly the same URL and set the OIDC service-account email to `TIME_MACHINE_SCHEDULER_SERVICE_ACCOUNT_EMAIL`. The endpoint rejects tokens issued for another audience or service account.

## Break-glass deployment rollback

Authenticate locally with Application Default Credentials:

```bash
gcloud auth application-default login
npm run time-machine -- deployment list
TIME_MACHINE_CONFIRM="ROLLBACK DEPLOYMENT" TIME_MACHINE_REASON="Incident reference" npm run time-machine -- deployment rollback BUILD_ID
```

The local operator needs App Hosting build read and rollout create permissions. This path does not depend on the production app being healthy.

## Recovery rules

- Content snapshots contain only `courses`, `lessons`, and `contentMetadata`.
- Restore always creates a `pre-restore` checkpoint before acquiring the maintenance lock.
- A failed restore keeps the maintenance lock. Select its `pre-restore` checkpoint in the admin Time Machine to reverse the partial restore, or retry the original checkpoint.
- Never manually delete `contentOperations/maintenance-lock` until the associated restore job has been reviewed.
