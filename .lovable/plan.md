# Separate Christine & Mark on the LinkedIn drill-down

## The problem

Both LinkedIn widgets on the dashboard correctly filter posts by `account_label` ("Christine" vs "Mark"), but when you click **Drill down →**, both link to the same `/linkedin` page — and that page ignores `account_label` entirely. So Christine's table shows Mark's posts mixed in, and vice versa.

## The fix

Make the drill-down page account-aware, with the account coming from the URL so each widget links to its own view.

### 1. Add an `account` search param to `/linkedin`

`/linkedin?account=christine` → Christine view
`/linkedin?account=mark` → Mark view
(default: `christine`, to preserve current behavior)

Use TanStack Router's `validateSearch` so the param is type-safe.

### 2. Filter posts and weekly snapshots by account

In `src/routes/linkedin.tsx`, filter both `posts` and `weekly` by `account_label === account` before any of the existing memos run (KPIs, followers chart, table, totals). All downstream logic stays unchanged.

### 3. Update the page header + title

- Title: "LinkedIn — Christine" or "LinkedIn — Mark"
- Subtitle counts reflect the filtered set
- Add a small account toggle (two pills: Christine / Mark) in the header so you can flip between them without going back to the dashboard
- `head()` meta title updates to match

### 4. Wire up widget links

In `src/components/mc/LinkedInWidget.tsx`, change the drill-down `<Link>` to pass `search={{ account: account.toLowerCase() }}` so Christine's widget links to `?account=christine` and Mark's to `?account=mark`.

## Files touched

- `src/routes/linkedin.tsx` — add search param, filter by account, account toggle in header, dynamic title
- `src/components/mc/LinkedInWidget.tsx` — pass `account` to drill-down link

No DB changes, no query changes — `account_label` is already on both `linkedin_posts` and `linkedin_weekly_metrics`.
