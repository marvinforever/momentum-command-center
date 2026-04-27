## Add Admin Link to Home Page

Add a discreet "Admin" link in the home page header so you can jump directly to `/admin` (and from there into Integrations) without typing the URL.

### Where it goes

Inside the existing `PageHeader` on the home page (`src/routes/index.tsx`), in the right-side cluster next to the "All channels reporting" pill and the "Sign out" button. This keeps it on-brand with the existing header treatment and avoids cluttering the dashboard body.

On mobile it will sit in the same row as the status pill (which already wraps), so it stays reachable without taking vertical space.

### Implementation

1. Extend `PageHeader` (`src/components/mc/PageHeader.tsx`) with an optional `rightSlot?: ReactNode` prop rendered just above the "Sign out" button.
2. In `src/routes/index.tsx`, pass a `<Link to="/admin">Admin</Link>` styled to match the existing small uppercase nav text (same look as breadcrumbs / "Sign out": `text-[11px] text-ink-muted hover:text-gold transition-colors`, with a small `Settings` icon from `lucide-react`).
3. No route changes — `/admin` already exists.

### Out of scope

- No global nav bar refactor.
- No role-gating UI (the admin route itself already controls access). If you'd like the link to only show for admin users, say the word and I'll wire it to the `useAuth` role check.