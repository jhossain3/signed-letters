

## Two-Stage Email Notification System

This plan implements a dual-notification flow for letters sent to external recipients, while keeping the single notification for self-sent letters.

### Current Behavior vs. Desired Behavior

| Scenario | Current | Desired |
|----------|---------|---------|
| Self-sent letter | 1 email on delivery date | 1 email on delivery date (no change) |
| Letter to someone else | 1 email on delivery date | 2 emails: one when sent + one on delivery date |

---

### Implementation Overview

**1. Database Changes**

Add a new column to track whether the initial "letter sent" notification has been delivered:

- Add `initial_notification_sent` boolean column (default: `false`) to the `letters` table
- This separates the "you've been sent a letter" notification from the "letter is ready to open" notification

**2. New Edge Function: Send Initial Recipient Notification**

Create a new edge function `send-recipient-notification` that:
- Is called immediately when a letter is created for someone else
- Sends a "Someone is writing you a letter" email to the recipient
- Includes the unseal/delivery date in the email so they know when to expect it
- Updates `initial_notification_sent` to `true`

**3. Frontend Changes**

Update `useLetters.ts` to:
- After successfully creating a letter with `recipientType === "someone"`, immediately invoke the new `send-recipient-notification` edge function
- Pass the letter ID so the function knows which letter to process

**4. Update Existing Edge Function**

Modify `send-letter-notifications` to:
- For self-sent letters: continue sending "Your letter is ready" email (no change)
- For letters to others: send a "Your letter is ready to open" email (different from the initial notification)
- Keep using the existing `notification_sent` flag for delivery-date notifications

**5. New Email Templates**

Create two distinct email templates for external recipients:

| Email | When Sent | Message | CTA |
|-------|-----------|---------|-----|
| Initial | Immediately on letter creation | "Someone is writing you a letter that will arrive on [date]" | "Create Account" |
| Delivery | On unseal date | "Your letter is ready to open!" | "Open Your Vault" |

---

### Technical Details

**Database Migration:**
```sql
ALTER TABLE public.letters 
ADD COLUMN initial_notification_sent boolean DEFAULT false;
```

**New Edge Function (`send-recipient-notification`):**
- Accepts letter ID as input
- Validates the letter exists and has `recipient_type = 'someone'`
- Sends the initial notification email with delivery date information
- Sets `initial_notification_sent = true`

**Updated `useLetters.ts`:**
```typescript
// After successful letter creation for someone else
if (letter.recipientType === "someone" && letter.recipientEmail) {
  await supabase.functions.invoke('send-recipient-notification', {
    body: { letterId: data.id }
  });
}
```

**Modified `send-letter-notifications`:**
- For external recipients on delivery date: uses a "ready to open" template
- For self-sent on delivery date: uses existing "your letter has arrived" template

---

### Email Content Summary

**Initial Notification (sent immediately):**
- Subject: "Someone is sending you a letter"
- Body: A letter titled "[title]" will arrive on [delivery_date]. Sign up to receive it.
- CTA: "Create Account"

**Delivery Notification (sent on unseal date):**
- Subject: "Your letter is ready to open!"
- Body: The letter "[title]" is now available in your vault.
- CTA: "Open Your Vault" (or "Create Account" if not registered)

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/send-recipient-notification/index.ts` | Create new |
| `supabase/functions/send-letter-notifications/index.ts` | Update email templates |
| `src/hooks/useLetters.ts` | Add immediate notification call |
| Database migration | Add `initial_notification_sent` column |

