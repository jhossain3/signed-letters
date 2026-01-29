

## Plan: Fix Signup Rate Limit Issues

### Problem Summary
Users are hitting signup rate limits even on their first attempt because:
1. Supabase has an IP-based rate limit for signup attempts (applies across ALL emails from the same IP)
2. Previous testing from the same network consumed the rate limit budget
3. The old error message is appearing because it comes directly from Supabase's API, not our custom handling

### Solution

**1. Improve Error Message Detection**
Update the error handling to catch the exact Supabase error message pattern and provide a clearer, friendlier message to users.

**2. Enable Auto-Confirm for Signups**
This was previously attempted but may not have taken effect. Auto-confirm allows users to be immediately logged in without email verification, which reduces the number of API calls that count toward rate limits.

**3. Add Retry Logic with Exponential Backoff**
Automatically retry the signup request once after a short delay when a rate limit is hit, which often succeeds.

---

### Technical Details

**File: `src/pages/Auth.tsx`**

Changes to error handling:
- Detect the exact error string "Too many signup attempts" from Supabase
- Add a visual retry countdown timer when rate limited
- Implement automatic retry after 5 seconds
- Show clearer guidance: "Please try again in a moment" vs blaming the user

```text
Error Detection Pattern:
  Before: Only checking for "rate limit", "over_email_send_rate_limit", "too many requests"
  After:  Also check for "Too many signup attempts" (exact Supabase message)
```

**New UI behavior when rate-limited:**
- Show a helpful message explaining the situation
- Display a countdown timer
- Auto-retry after the countdown completes
- If retry fails, suggest trying from a different network (mobile data vs WiFi)

**File: `src/contexts/AuthContext.tsx`**

Add retry wrapper for signUp function:
- First attempt as normal
- If rate limited, wait 5 seconds and retry once
- If still failing, return the error to the UI

---

### Why This Happens

The Supabase rate limit is designed to prevent abuse but can be triggered legitimately when:
- Testing from a development environment with multiple test accounts
- Users on shared IP addresses (office, university, mobile carrier NAT)
- VPN users sharing exit nodes

### Expected Outcome

After implementation:
- Users will see a friendlier message when rate limited
- Automatic retry will succeed in most cases after a short wait
- Users won't blame themselves or think the site is broken

