Build 4.5.1 Hotfix — 24 Oct 2026

Fixes:
- Restores the missing Developer Notes dialog/button markup, which previously caused app.js to stop before Register/Login handlers were attached.
- Makes Developer Notes handlers optional so missing UI cannot break authentication again.
- Improves Supabase recovery-link detection and shows Set New Password when a recovery session is available.
- Keeps QC hidden, modular source layout, and Build 4.4 inventory calculations unchanged.

GitHub: Upload the website files in this ZIP to repository root, replacing older versions. No new SQL needed.
Supabase: Authentication > URL Configuration > Redirect URLs: https://puro-ai.github.io/Washing_Line_ERP/
Test: Click Register, switch back to Sign In, request a NEW password reset email, open its link in the same browser, and set a new password.
NOTE: Live Supabase email delivery and redirect behavior cannot be fully verified offline.
