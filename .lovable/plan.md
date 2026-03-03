

## Plan: Event Submission Flow

### Overview
Add a multi-step event flow at `/event/:slug` where live event attendees authenticate and submit physical letter posting details. This is completely separate from the existing letter-writing flow.

### 1. Database Migration

Create two tables (`events`, `event_submissions`) with the exact schema provided. RLS policies allow anyone to view active events, and authenticated users to manage their own submissions. Also insert the test event row.

Add `updated_at` trigger for both tables reusing the existing `update_updated_at_column()` function.

### 2. New Files

**`src/pages/EventFlow.tsx`** — Single page component managing the entire 5-step flow:
- Reads `:slug` from URL params
- Fetches event by slug; shows inactive message if not found
- Manages step state (1: Auth, 2: Details, 3: Letter, 4: Recipient, 5: Confirm)

**Step 1 — Auth Landing**: If user not authenticated, show event name/date with Sign In / Create Account forms (inline, reusing the same auth logic from `useAuth`). On successful auth, auto-advance to step 2.

**Step 2 — Event Details**: Name (required), DOB (optional date picker), Gender (optional select), Marketing consent (pre-ticked checkbox). Heading contextualises it for returning users.

**Step 3 — Letter Details**: Letter date (default today, editable date picker), Posting date (date picker, min 24h from now) with tooltip about Royal Mail delivery.

**Step 4 — Recipient Details**: Recipient name (required), address (required textarea) with tooltip about editing window.

**Step 5 — Confirmation**: Summary of all details including estimated arrival (posting date + 3-5 working days, skipping weekends/bank holidays). "Seal It" button inserts into `event_submissions`, then shows success screen.

### 3. Routing

Add route in `App.tsx`:
```
<Route path="/event/:slug" element={<EventFlow />} />
```

### 4. Key Design Decisions

- Auth is handled inline on the event page (not redirecting to `/auth`) so the event context is preserved
- All form state held in component state, submitted in one insert at confirmation
- UK bank holidays for 2026 hardcoded for arrival estimate calculation
- Uses existing UI components: Calendar, Popover, Input, Textarea, Select, Checkbox, Button, Tooltip
- Mobile-first, consistent with app's warm cream/maroon aesthetic
- No changes to any existing tables, data, or routes

### 5. Files Changed

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/event/:slug` route |
| `src/pages/EventFlow.tsx` | New — full multi-step flow |
| Migration SQL | Create tables, RLS, insert test event |

