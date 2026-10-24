# Push notifications setup (Firebase Cloud Messaging)

This guide sets up **announcement push notifications** for the Android mobile app(s). Follow it once per Firebase project, and repeat the environment-variable part on every server you deploy (local, UAT, production).

Push is **optional**: if it isn't configured, the backend runs normally, announcements still save, and the app still shows notifications while it is open (from the live socket). Only notifications on a **closed or backgrounded** app need this setup.

---

## 1. How it works (read this first)

- The backend sends push through **Firebase Cloud Messaging (FCM)**, using **topics**. **No device tokens are stored** in our database.
- After login, each phone subscribes to topics that match the user's **business, role and batches**, for example:
  - `ck-b12-admins`: admins of business 12
  - `ck-b12-students-all`: every student of business 12
  - `ck-b12-batch34-students`: students in batch 34 of business 12
- When an announcement is **created or edited** and is **live right now** (active, and today is between its start and end date), the backend pushes to the topics of everyone who can see it.
- An announcement scheduled for later is pushed **when its start time arrives**. A check runs every minute.
- Deleting an announcement sends nothing.
- Only **Android** is supported for now.

| Part | What it needs |
|---|---|
| Firebase project | One project (for example `contentkosh-app`) shared by **all** our Android apps |
| Backend (this repo) | 3 env vars from a Firebase service account; optionally `PUSH_TOPIC_PREFIX` |
| Mobile app | `google-services.json` from the same Firebase project, then a rebuild |

---

## 2. Prerequisites

- Owner or Editor access to the Firebase / Google Cloud project.
- Access to the backend server's environment variables.
- Access to the mobile app repo (`contentkosh-mobile`) and its build setup (local or EAS).

---

## 3. Firebase project

Use the existing project **`contentkosh-app`** if it is already set up. To create a new one:

1. Go to <https://console.firebase.google.com> → **Add project**.
2. Enter a name (for example `contentkosh-app`) and finish the wizard. Google Analytics is optional.

> **Use one Firebase project for all institute apps** (ContentKosh, Vidit, …). The backend has a single set of Firebase credentials, so apps in a different Firebase project will not receive push.

---

## 4. Add each Android app and get `google-services.json`

Do this for **every Android package name** you build. The package name comes from `ANDROID_PACKAGE` in the mobile `.env`, falling back to `android.package` in `app.json`.

1. Firebase console → your project → **gear icon** (next to "Project Overview") → **Project settings** → **General** tab.
2. Under **Your apps**, click **Add app** → **Android**.
3. **Android package name**: enter it exactly (for example `com.contentkosh.mobile` or `com.viditpublication.app`). Nickname is optional; SHA-1 is **not** needed for push.
4. Click **Register app**. Skip the remaining SDK steps; the app already includes the SDK.
5. After all apps are added, go back to **Project settings → General**, select any of the Android apps, and click **Download google-services.json**.
   - The file lists **every** Android app in the project, so **one file works for all builds**.
   - Each time you add a package, download it again.

Put the file in the mobile repo. Section 9 explains how.

---

## 5. Check that the Cloud Messaging API is enabled

1. Firebase console → **Project settings** → **Cloud Messaging** tab.
2. Under **Firebase Cloud Messaging API (V1)** it should say **Enabled**.
3. If it is disabled, use the **⋮** menu there → **Manage API in Google Cloud Console** → **Enable**.

(The old "Cloud Messaging API (Legacy)" is not used and can stay disabled.)

---

## 6. Create the service-account key (backend credentials)

1. Firebase console → **Project settings** → **Service accounts** tab.
2. With **Firebase Admin SDK** selected, click **Generate new private key** → **Generate key**.
3. A JSON file downloads. **Treat it like a password**:
   - Never commit it to git.
   - Never paste it into chats or tickets.
   - Store it in your password manager / secret store.

You need three fields from it:

| JSON field | Backend env var |
|---|---|
| `project_id` | `FIREBASE_PROJECT_ID` |
| `client_email` (looks like `firebase-adminsdk-xxxxx@<project>.iam.gserviceaccount.com`) | `FIREBASE_CLIENT_EMAIL` |
| `private_key` (starts with `-----BEGIN PRIVATE KEY-----`) | `FIREBASE_PRIVATE_KEY` |

---

## 7. Give the service account permission to send (IAM)

Without this step every push fails with `403 PERMISSION_DENIED … cloudmessaging.messages.create`.

1. Firebase console → **Project settings** → **Service accounts** → click **Manage service account permissions** (link on the right). Google Cloud Console opens.
   You can also go directly to `https://console.cloud.google.com/iam-admin/iam?project=<your-project-id>`.
2. You are on **IAM & Admin → IAM**. Find the principal whose email equals `FIREBASE_CLIENT_EMAIL`.
3. Click the **pencil (Edit principal)** icon on that row.
   If the email is not listed, click **Grant access** at the top and paste the email into **New principals**.
4. Click **Add another role**, search for **Firebase Cloud Messaging API Admin**, and select it.
5. Click **Save**. Changes can take **2–5 minutes** to apply.

---

## 8. Backend environment variables

Set these on **every** backend environment that should send push (`.env` locally, or your hosting provider's environment settings for UAT/production):

| Variable | Required | Example | Notes |
|---|---|---|---|
| `FIREBASE_PROJECT_ID` | Yes | `contentkosh-app` | `project_id` from the key file |
| `FIREBASE_CLIENT_EMAIL` | Yes | `firebase-adminsdk-abc12@contentkosh-app.iam.gserviceaccount.com` | `client_email` from the key file |
| `FIREBASE_PRIVATE_KEY` | Yes | see below | `private_key` from the key file |
| `PUSH_TOPIC_PREFIX` | No (default `ck`) | `ck` / `ck-uat` | Must match the app's `EXPO_PUBLIC_PUSH_TOPIC_PREFIX`. See section 10 |

### `FIREBASE_PRIVATE_KEY` format

The key is several lines long. Either of these works.

**In a `.env` file:** keep it on **one line**, wrap it in **double quotes**, and keep the `\n` sequences exactly as they appear in the JSON file:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqh...\n...\n-----END PRIVATE KEY-----\n"
```

**In a hosting dashboard** (Render, Railway, a VPS env file, Docker secrets, …): paste the value either with the `\n` sequences (as above, without the outer quotes if the dashboard adds its own) or as the real multi-line key. The backend accepts both.

Common mistakes:
- Copying only part of the key. It must include the `-----BEGIN…` and `-----END…` lines.
- Removing the `\n` sequences so everything runs together. That gives the error `DECODER routines::unsupported`.
- Copying `client_email` or `project_id` from a **different** Firebase project than `google-services.json`.

After changing env vars, **restart the backend**. Env vars are read at startup.

---

## 9. Mobile app configuration

In `contentkosh-mobile`:

1. **`google-services.json`**, using one of these:
   - **Local builds:** put it at `contentkosh-mobile/google-services.json`.
   - **EAS builds:** upload it as a **file** environment variable named `GOOGLE_SERVICES_JSON` (EAS dashboard → Project → Environment variables → type *File*), or commit it to the repo. The app config uses `GOOGLE_SERVICES_JSON` if set, otherwise `./google-services.json`.
   - If neither exists, the app **still builds**; push is simply off.
2. **Topic prefix** (only if you changed it on the backend): set `EXPO_PUBLIC_PUSH_TOPIC_PREFIX` in the mobile `.env` / EAS profile to the **same** value as the backend's `PUSH_TOPIC_PREFIX`.
3. **Rebuild the app.** Push uses native modules, so an over-the-air/JS update is not enough:
   - Local: `npx expo prebuild --clean` then `npx expo run:android`
   - EAS: `eas build -p android --profile <profile>`
4. Install the new build. On first launch the app asks for **notification permission**; the user must allow it.

---

## 10. Several apps and several environments

**Several institute apps, one backend:** add every Android package to the **same** Firebase project (section 4). One backend with one set of Firebase env vars serves all of them. Topics include the business id, so each institute's announcements only reach that institute's users, whichever app they use. No per-app backend configuration is needed.

**Several environments (UAT, production):**

- **Separate Firebase projects per environment (recommended for strict isolation):** use each project's own credentials in that environment's backend, and that project's `google-services.json` in the matching app builds. `PUSH_TOPIC_PREFIX` can stay `ck` everywhere.
- **One shared Firebase project:** give each environment its **own prefix**, otherwise a UAT announcement for business 12 would also reach production users of business 12:

  | Environment | Backend `PUSH_TOPIC_PREFIX` | App `EXPO_PUBLIC_PUSH_TOPIC_PREFIX` |
  |---|---|---|
  | Production | `ck` | `ck` |
  | UAT | `ck-uat` | `ck-uat` |

  Allowed characters in the prefix: letters, digits and `- _ . ~ %`.

---

## 11. Verify the setup

1. **Restart the backend.** If the Firebase vars are missing you will see this the first time an announcement is saved:
   `[push] skipped: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not set`
2. On an Android phone with the **new build**:
   - Log in as a **student** who is in a batch.
   - Allow notifications.
   - Fully **close** the app.
3. As an admin (web or app), create an announcement that is:
   - **visible to students**
   - **active**, with the start date now or earlier
   - targeted at that student's batch, or at all batches
4. Within a few seconds the backend logs should show:
   ```
   [push] announcement id=<id> kind=created businessId=<bid> topics=<n>
   [push] sent topics=<n> messages=<m> failed=0
   ```
5. The phone shows the notification with the default sound. Tapping it opens the announcement.

To test **scheduled** announcements, create one that starts a couple of minutes from now. The log first shows `not live yet; push deferred to start time`, then, within a minute of the start time, a `kind=started` line.

---

## 12. Troubleshooting

| Symptom / log line | Cause | Fix |
|---|---|---|
| `[push] skipped: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not set` | Env vars missing or empty on this server | Section 8, then restart |
| `[push] send failed: … DECODER routines::unsupported` | `FIREBASE_PRIVATE_KEY` badly formatted | Re-copy the full key keeping the `\n` sequences (section 8) |
| `[push] send failed: … invalid_grant` / `Invalid JWT Signature` | Key revoked/deleted, or email and key from different keys | Generate a new key (section 6) and update **all three** vars |
| `[push] send failed: FCM 403 … PERMISSION_DENIED … cloudmessaging.messages.create` | Service account lacks the send role | Section 7 (wait a few minutes after saving) |
| `[push] send failed: FCM 403 … SERVICE_DISABLED` | Cloud Messaging API (V1) is off | Section 5 |
| `[push] send failed: FCM 404` | Wrong `FIREBASE_PROJECT_ID` | Use `project_id` from the key file |
| `… not live yet; push deferred to start time` | Announcement starts in the future, or is inactive | Expected; it is sent when it starts |
| `[push] sent … failed=0` but the phone gets nothing | See the next rows | |
| — | App built **without** `google-services.json`, or an older build | Section 9, rebuild and reinstall |
| — | Notification permission denied | Phone **Settings → Apps → (app) → Notifications** → allow |
| — | Prefix mismatch between backend and app | Same value on both sides (section 10) |
| — | User isn't in the targeted batch, or the role isn't in the announcement's visibility | Check the announcement's audience. The user's own announcements also aren't shown in the app's list |
| — | Phone hasn't opened the app since joining the batch | Topics refresh when the app opens; open it once |
| — | Aggressive battery saver (some Xiaomi/Oppo/Vivo phones) | Allow the app to run in background / disable battery optimisation for it |
| Android build fails: `No matching client found for package name '…'` | That package isn't in `google-services.json` | Section 4: add the app, download the file again |

---

## 13. Rotating or revoking the key

1. Generate a new key (section 6) and update the three env vars on every backend environment. Restart.
2. Confirm push works (section 11).
3. Delete the old key: Google Cloud Console → **IAM & Admin → Service accounts** → the `firebase-adminsdk-…` account → **Keys** tab → delete the old key ID.

If a key has leaked, delete it **first**. Push stops until the new key is deployed.

---

## 14. Code reference

| File | Purpose |
|---|---|
| `src/config/push.config.ts` | Env vars, topic prefix, Android channel, cron schedule |
| `src/services/fcmPush.service.ts` | Authenticates with Google and sends to FCM topics |
| `src/services/announcementPush.service.ts` | Decides who receives an announcement and when; the scheduled-start check |
| `src/constants/announcement.constants.ts` | `ANNOUNCEMENT_PUSH_TOPICS`: topic names (must match the app's `src/constants/pushTopics.ts`) |
| `src/index.ts` | Registers the every-minute scheduled-start job |
