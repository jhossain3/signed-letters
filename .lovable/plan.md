
## Fix Self-Sent Same-Day Email Notifications

Currently, when a user sends a letter to themselves for today, the email notification doesn't arrive. This is due to two issues in the notification flow.

---

### Problem 1: Notification Flag Set Before Confirming Email Delivery

The edge function marks `notification_sent = true` immediately after calling Resend, without checking if the email was actually sent successfully. If Resend returns an error, the letter is still flagged as "notified" and won't be retried.

**Fix:** Check Resend's response for errors before updating the database flag.

---

### Problem 2: Edge Function Not Actually Invoking from Frontend

The console logs show no evidence of `triggerImmediateNotification()` being called. The function only triggers when `BYPASS_DELIVERY_DATE` is enabled AND the delivery date matches today - but the check happens in `onSuccess` after a 500ms delay, which may be causing timing issues.

**Fix:** Trigger the notification immediately after letter creation for self-sent same-day letters, with better logging.

---

### Technical Changes

**1. Update `send-letter-notifications/index.ts`**

Add proper error handling for Resend responses:

```text
┌──────────────────────────────────────────────┐
│ Current Flow                                  │
├──────────────────────────────────────────────┤
│ 1. Call resend.emails.send()                 │
│ 2. Mark notification_sent = true              │
│    (even if Resend returned an error!)       │
└──────────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────┐
│ Fixed Flow                                    │
├──────────────────────────────────────────────┤
│ 1. Call resend.emails.send()                 │
│ 2. Check response for error                  │
│ 3. Only mark notification_sent = true        │
│    if email was successfully sent            │
└──────────────────────────────────────────────┘
```

**2. Update `useLetters.ts`**

- Call `triggerImmediateNotification()` directly for self-sent same-day letters, not just when `BYPASS_DELIVERY_DATE` is true
- Add console logging to confirm the function is being invoked
- Remove the 500ms delay that may cause race conditions

---

### Database Reset (One-Time)

Since existing letters were incorrectly marked as `notification_sent = true` despite emails never being delivered, we can optionally reset recent letters to allow re-delivery:

```sql
UPDATE letters 
SET notification_sent = false 
WHERE recipient_type = 'myself' 
  AND delivery_date::date = CURRENT_DATE
  AND notification_sent = true;
```

---

### Summary of Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/send-letter-notifications/index.ts` | Check Resend response for errors before setting `notification_sent` |
| `src/hooks/useLetters.ts` | Always trigger immediate notification for same-day self-sent letters |
