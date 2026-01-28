
## Feature: External Recipient Letter Delivery

### Completed Implementation

#### 1. Database Changes
- Added `recipient_user_id` column to `letters` table (UUID, nullable, FK to auth.users)
- Added indexes on `recipient_user_id` and `recipient_email` for efficient lookups
- Updated RLS policy to allow recipients to view letters sent to them:
  ```sql
  auth.uid() = user_id OR auth.uid() = recipient_user_id
  ```
- Created `link_pending_letters()` function that runs on user signup to associate pending letters

#### 2. Edge Function Updates
- `send-letter-notifications` now handles two types of notifications:
  - **Self-sent letters**: Sends "Your Letter Has Arrived" email to author
  - **Letters to others**: Sends "Someone Sent You a Letter" invitation email to recipient
- Invitation email directs recipients to sign up at `/auth`

#### 3. Frontend Updates
- `useLetters` hook:
  - Fetches both authored and received letters (RLS handles filtering)
  - Marks letters where user is recipient (not author) as "received"
  - Only encrypts self-sent letters (letters to others remain unencrypted so recipients can read them)

### Flow Summary

1. **User sends letter to someone@example.com**
   - Letter stored with `recipient_email` set
   - Letter NOT encrypted (so recipient can read it later)

2. **Delivery date arrives**
   - Edge function finds letter with `recipient_type = 'someone'`
   - Sends invitation email to `recipient_email`
   - Marks `notification_sent = true`

3. **Recipient signs up**
   - `on_auth_user_created_link_letters` trigger fires
   - `link_pending_letters()` finds letters with matching email
   - Updates `recipient_user_id` to new user's ID

4. **Recipient views vault**
   - RLS allows access via `recipient_user_id = auth.uid()`
   - Letter appears in "Received" tab
   - Letter is readable (not encrypted)

### Testing Checklist
- [ ] Send letter to unregistered email (set delivery date to today)
- [ ] Verify invitation email is sent
- [ ] Create account with that email
- [ ] Verify letter appears in Received tab
- [ ] Verify letter content is readable
