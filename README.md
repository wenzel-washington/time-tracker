# Time Tracker

Local-first time tracking built with Next.js, React, TypeScript, Tailwind CSS, Firebase Auth, and Firestore.

The app works out of the box in local mode and stores data in the browser. The public repository stays generic: cloud sync only turns on when Firebase config is provided.

## Features

- Start, pause, resume, and stop a live timer.
- Create manual time entries by setting custom start and end timestamps.
- Edit existing entries inline, including task name and timestamps.
- Create and delete projects with color labels.
- See totals by project for today, this week, and all time.
- Export all tracked entries as CSV.
- Toggle dark mode.
- Use keyboard shortcuts: `Space` starts or pauses, `Enter` saves.
- Store data locally by default, with optional Firebase-backed sync.
- Use the app on desktop and mobile layouts.

## Deployment Model

- Local clones run without Firebase by default and use `localStorage`.
- The hosted version on `futurenaut.co` can inject real Firebase config via environment variables.
- If someone wants cloud sync in their own deployment, they can add their own Firebase project values.
- Firebase web config is public by nature in a browser app, so security depends on Firestore rules and Auth settings, not on hiding `NEXT_PUBLIC_*` values.

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Firebase Auth
- Cloud Firestore
- date-fns
- Lucide React
- Base UI / shadcn components

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run in local-only mode

```bash
npm run dev
```

Then open `http://localhost:3000`.

In this mode, entries and projects are stored in `localStorage`. Google sign-in and cloud sync stay disabled.

### 3. Optional: enable Firebase sync locally or in your own deployment

Copy `.env.example` to `.env.local` and fill in your own Firebase web app values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_FIRESTORE_DATABASE_ID=(default)
```

You also need:

- Google Auth enabled in Firebase Authentication.
- A Firestore database.
- Firestore rules that restrict each user to their own documents.
- Authorized domains configured in Firebase Authentication for every domain that should support login.

The repository includes an example rule set in [`firestore.rules`](./firestore.rules).

## Data Model

- `users/{userId}/projects/{projectId}`
- `users/{userId}/entries/{entryId}`

Projects and entries are scoped per authenticated user when Firebase is configured.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## Public Repo Checklist

This repository is set up so you do not need to commit private credentials:

- Real Firebase project configuration is no longer stored in the repo.
- `.env.local` and other `.env*` files are ignored.
- `.env.example` only contains placeholders.
- Production deployments can still inject real Firebase values through environment variables.

Before publishing, verify that you have not committed any historical secrets in earlier Git commits.

## License

MIT. See [LICENSE](./LICENSE).
