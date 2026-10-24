Glowmore FGMS Cloud Build 4.5 Modular (QC Hidden)

Changes:
- Developer Notes light bulb in the green banner. Click for Re-sort input/output/yield-loss explanation.
- Forgot Password link on login, Supabase email recovery and new-password screen.
- Quality Control sidebar remains hidden; QC source and data are retained.
- Production, Inventory, Delivery, Administrator business logic unchanged.

Deployment: upload all 13 web files to the GitHub Pages repository root (not SQL or README files).
Supabase Dashboard -> Authentication -> URL Configuration:
Add https://puro-ai.github.io/Washing_Line_ERP/ to Redirect URLs.
Ensure SMTP/email delivery is configured and test password reset email. Recovery emails may be subject to Supabase email limits.

If you have not yet applied the Build 4.4 Re-sort database update, run UPDATE_DATABASE_BUILD4_4_RESORT.txt in Supabase SQL Editor first. This Build 4.5 adds no new database tables.

Note: recovery requires a valid, unexpired email link. This app is a static frontend and cannot recover a password without Supabase Auth and working email delivery.
