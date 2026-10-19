# Email templates

The emails Supabase sends, through Brevo (custom SMTP). Paste each file into **Supabase -> Authentication -> Emails -> Templates**,
with the subject below. They are kept here so a change can be reviewed like code.

| Supabase template | File | Subject |
|---|---|---|
| Confirm signup | `confirm-signup.html` | Confirm your email for AI Semester Planner |
| Reset password | `reset-password.html` | Choose a new password for AI Semester Planner |
| Change email address | `change-email.html` | Confirm your new email for AI Semester Planner |

## Why the links are written this way

- **Reset password** links to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`. `RedirectTo` is the address the app asks
  for (`<site>/reset-password`, in `app/auth-form.js`), so there is no double slash from the Site URL's trailing `/`. The page checks the
  one-time code only when the new password is submitted (`app/reset-password/page.js`), so the link works in any browser and an email
  scanner opening it does not use it up.
- **Change email address** is sent to both the old and the new address (Supabase's "Secure email change", on by default), and the
  email changes only after both links are opened. After the first, Supabase sends the browser back with a message, which
  `app/link-landing.js` shows ("Half done: now open the link sent to your other email address").
- **Confirm signup** and **Change email address** keep Supabase's `{{ .ConfirmationURL }}`. Opened on another device, the address is
  still confirmed, but the student is not signed in there and signs in as usual.

## Limits

- Brevo's free plan sends 300 emails a day. Supabase's own email rate limit is under Authentication -> Rate Limits.
- From a `@gmail.com` sender these often land in spam, because Gmail says its addresses should only send from Google's servers.
  Testers should check their spam folder; a domain of our own would fix it.
