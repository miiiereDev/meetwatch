# Connecting MeetWatch to real Google Meet meetings

MeetWatch can track a real Google Meet call through the Meet REST API v2. This
walks through the one-time setup. Everything works without it — the default
simulator provider needs no Google account.

## What you need

- A Google account that will join the Meet call (any gmail.com account works).
- A Google Cloud project (free; https://console.cloud.google.com).

## 1. Create the OAuth client

1. In the Cloud Console, open **APIs & Services → Library** and enable the
   **Google Meet API**.
2. Open **APIs & Services → OAuth consent screen**:
   - User type **External** (a personal gmail project has no "Internal" option).
   - Fill in the required app fields, add yourself under **Test users**.
   - Scopes stay at the default; MeetWatch requests only read-only Meet scopes
     at sign-in time.
3. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized redirect URIs: `http://localhost:4000/api/google/callback`
     (adjust host/port if you changed `HOST`/`PORT`).
4. Copy the **Client ID** and **Client secret**.

## 2. Configure the API

Set the following environment variables before starting the API (for example
in `.env` at the repo root, which is gitignored):

```env
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:4000/api/google/callback
```

`MEET_POLL_INTERVAL_MS` (default 15000) controls how often live meetings are
polled.

## 3. Connect and track

1. Start the stack: `pnpm dev`.
2. In the web app open **Settings → Google Meet integration → Connect Google
   account**, sign in with the account that joins the meeting, and grant the
   two read-only scopes. The refresh token is stored in the local database.
3. Switch **Provider** to _Google Meet (live)_.
4. Create a session (Settings → Simulator → _Start demo session_, or any API
   client) whose **meeting code** matches your real Meet code, e.g.
   `abc-mnop-qrst` from the link `https://meet.google.com/abc-mnop-qrst`.
5. While the meeting is live, the provider polls the conference record every
   15 s and streams join/leave activity to the dashboard. Students are matched
   to the roster by email when the API exposes it, by the participant's guest
   display name otherwise; anything unmatched lands in the dashboard's
   **Unknown participants** panel for manual mapping.

## Behaviour notes and limitations

- **Polling, not push.** The Meet API has no event stream; join/leave times can
  lag reality by up to one poll interval.
- **Signed-in names.** For accounts in the same Workspace domain the API may
  return the user as an opaque `users/{id}` resource instead of a name or
  email. MeetWatch then shows that identifier and cannot match it to the
  roster automatically — map it once from the Unknown participants panel and
  the mapping is remembered for future meetings. Guest participants (who type
  a name) are matched by display name directly.
- **Session model.** Create one MeetWatch session per Meet call; the provider
  attaches the newest conference record for that meeting code. Ending the
  MeetWatch session closes any still-open intervals at that moment.
- **Errors.** Rate limits and server errors trigger exponential backoff
  (visible as a banner on the dashboard); an expired or revoked token moves
  the provider to _needs auth_ — reconnect from Settings.

## Security notes

- The OAuth **refresh token** is stored in plain text in the local SQLite
  database (`apps/api/data/`, gitignored). Treat that file like a password:
  it is fine for a single-teacher, single-machine school tool, but do not copy
  the database around or commit it.
- Only read-only Meet scopes are requested; MeetWatch can never start meetings
  or change anything.
- To revoke access, remove MeetWatch at
  https://myaccount.google.com/permissions and delete the data directory.
