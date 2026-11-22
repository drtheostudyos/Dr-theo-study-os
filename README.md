# Dr Theo Study OS — setup guide

## What this version does
- Records topic-level first-study dates, MCQ accuracy, confidence and revision history.
- Generates a daily due/overdue queue.
- Adjusts the next revision interval using recall and MCQ accuracy.
- Includes a study stopwatch with start/pause/finish, dated session history, subject/topic labels and daily/7-day/all-time totals.
- Supports JSON backup/import.
- Can sync across devices through a separate Supabase project.

## Important
This is an adaptive scheduling heuristic, not a guarantee of perfect retention. Enter honest recall scores after each revision. Do not put private keys in `config.js`.

## Step 1 — Create a new Supabase project
1. Sign in at https://supabase.com using the Gmail you want for this app.
2. Create a **new project**. Do not reuse the MedMCQ project.
3. Save the database password somewhere secure.
4. Wait until the project is ready.

## Step 2 — Create the database table
1. Open the new project → SQL Editor → New query.
2. Open `schema.sql` from this folder, copy all its contents and paste into SQL Editor.
3. Click Run. It should create `study_data` and its row-level security policies.

## Step 3 — Add Supabase keys
1. In Supabase open Project Settings → API (or API Keys).
2. Copy the Project URL and the publishable key (or legacy anon public key).
3. Open `config.js` and replace the two placeholder values.
4. Never use `service_role`, `secret`, or a private key in the website.

## Step 4 — Publish on GitHub Pages
1. Create a new GitHub repository named `dr-theo-study-os`.
2. Upload all files in this folder to the repository root (not the ZIP itself).
3. In repository Settings → Pages, select Deploy from a branch → `main` → `/ (root)` → Save.
4. Your site URL will be `https://YOUR-GITHUB-USERNAME.github.io/dr-theo-study-os/`.

## Step 5 — Configure Supabase Auth
1. In Supabase → Authentication → URL Configuration.
2. Set Site URL to your GitHub Pages URL.
3. Add the same URL to Redirect URLs.
4. If email confirmation is enabled, confirm the email after signup.

## Step 6 — Test
1. Open the published website, create an account and add a test topic.
2. Open the same website on your other device and sign in with the same account.
3. Confirm the topic appears. Export JSON backups periodically.

## Scheduling logic
- Poor recall (1/5) or under 50% MCQ accuracy: next review in 1–2 days.
- Weak/moderate recall or under 65% accuracy: 3–4 days.
- Moderate recall: interval grows gradually.
- Strong recall (5/5) and high accuracy: 2, 7, 14, 30, 60, then 90 days.
- Weak topics and overdue topics receive higher priority.

Study timer sessions are stored alongside topics and sync to Supabase when cloud sync is configured. A running timer is retained across page reloads on the same device.

The interval rules are a starting heuristic. We can tune them after real usage and add a bulk historical-topic importer in the next version.
