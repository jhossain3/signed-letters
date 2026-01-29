
## Fix Email Notifications with New Resend API Key

The edge functions are correctly configured to use `team@notify.signedletter.com` as the sender, but emails are failing because Resend is still treating the API key as being in "testing mode." This happens when the API key was created before domain verification completed, or is from a different account.

---

### Root Cause

The `RESEND_API_KEY` currently stored in your backend was likely generated before `notify.signedletter.com` was verified. Resend API keys are tied to the account's verification status at the time of creation.

---

### Solution

Generate a fresh API key from your Resend account (where the domain is verified) and update the secret.

**Steps:**

1. Go to https://resend.com/api-keys
2. Create a new API key with "Full access" or "Sending access" permissions
3. Copy the new key (it will only be shown once)
4. Update the `RESEND_API_KEY` secret with the new value

---

### What Happens Next

After updating the API key:
- The cron job that runs at midnight will attempt to send notifications for any letters with a delivery date of today
- You can also manually trigger a test by calling the edge function directly

---

### No Code Changes Required

Both edge functions are already correctly configured:

| Function | Sender Address |
|----------|---------------|
| `send-letter-notifications` | `signed <team@notify.signedletter.com>` |
| `send-recipient-notification` | `signed <team@notify.signedletter.com>` |

The issue is purely the API key authentication, not the code.
