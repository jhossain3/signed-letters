
## Create test_letters Table for Preview Environment

### Goal
When you're editing in Lovable (the preview URL), the app will automatically write to and read from a separate `test_letters` table, leaving your real production data in `letters` completely untouched.

### How Environment Detection Works

```text
Preview URL:   id-preview--....lovable.app  → uses test_letters
Localhost:     localhost:8080               → uses test_letters
Published URL: signed-letters.lovable.app  → uses letters (production)
```

A small utility checks `window.location.hostname` at runtime. No environment variables or config changes needed — it's fully automatic.

---

### Technical Steps

**Step 1 — Database Migration**

Create `test_letters` with the exact same schema as `letters`, plus matching RLS policies:

```sql
CREATE TABLE public.test_letters (
  -- All identical columns to letters
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  date text NOT NULL,
  delivery_date timestamptz NOT NULL,
  signature text NOT NULL,
  signature_font text,
  recipient_email text,
  recipient_type text NOT NULL,
  photos text[] DEFAULT '{}',
  sketch_data text,
  display_title text,
  paper_color text,
  ink_color text,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  is_typed boolean DEFAULT true,
  is_lined boolean DEFAULT true,
  notification_sent boolean DEFAULT false,
  initial_notification_sent boolean DEFAULT false,
  recipient_encrypted boolean DEFAULT false,
  recipient_user_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.test_letters ENABLE ROW LEVEL SECURITY;

-- Same policies as letters
-- Deny anon, allow own inserts/updates/deletes, allow viewing own + received
```

**Step 2 — Table Name Utility**

Create `src/lib/tableNames.ts`:

```typescript
const PRODUCTION_HOSTNAME = "signed-letters.lovable.app";

export function getLettersTable(): "letters" | "test_letters" {
  if (typeof window === "undefined") return "letters";
  return window.location.hostname === PRODUCTION_HOSTNAME
    ? "letters"
    : "test_letters";
}
```

**Step 3 — Update Hooks**

Replace every hardcoded `.from("letters")` call with `.from(getLettersTable())` in:

- `src/hooks/useLetters.ts` — 4 query/mutation calls
- `src/hooks/useDrafts.ts` — 3 query/mutation calls  
- `src/hooks/useReencryptForRecipients.ts` — 1 select call

**Step 4 — Visual Indicator (optional but recommended)**

Add a small "TEST MODE" badge in the Navbar when using `test_letters`, so it's always obvious which environment is active. This prevents confusion when switching between the preview and the published site.

---

### What This Does NOT Change

- The `user_encryption_keys` table is shared (same user, same keys work for both tables — this is fine since encryption is per-user, not per-table).
- Edge functions (`reencrypt-for-recipient`, `send-letter-notifications`, etc.) always operate on `letters`. Test data will not trigger real email notifications.
- The `link_pending_letters` DB trigger only fires on `letters` — test rows won't auto-link recipients.

### Files Changed

| File | Change |
|---|---|
| Migration (new) | Create `test_letters` table + RLS |
| `src/lib/tableNames.ts` | New utility: `getLettersTable()` |
| `src/hooks/useLetters.ts` | Use `getLettersTable()` |
| `src/hooks/useDrafts.ts` | Use `getLettersTable()` |
| `src/hooks/useReencryptForRecipients.ts` | Use `getLettersTable()` |
| `src/components/Navbar.tsx` | Add "TEST MODE" indicator |
