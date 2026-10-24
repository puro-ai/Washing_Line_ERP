Build 4.4 Modular — QC temporarily hidden

Quality Control sidebar group is hidden in index.html only. QC Entry, QC Files, QC Project Setup, qc.js, qc.css, and all database records are preserved. No Supabase SQL changes required to hide QC. To restore, remove style="display:none !important" aria-hidden="true" from the quality-control nav-group in index.html.

This is a UI visibility change, not a security permission change.
