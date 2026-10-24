Glowmore FGMS Cloud Build 4.4 QC FLAT

NEW RE-SORT LOGIC
- Re-sort Qty / Fail Bags Used: deducted from Fail Bags.
- Actual Output / Pass Bags Recovered: added to Finished Goods.
- Difference / Process Loss: Re-sort Qty minus Actual Output, shown automatically.
- Validation: both values must be > 0; Re-sort Qty cannot exceed remaining Fail Bags; Actual Output cannot exceed Re-sort Qty.
- Re-sort Records can be Edit/Delete to correct wrong entries.
- Editing recalculates stock automatically.
- Deleting soft-deletes the transaction and reverses its stock effect.
- Historical Re-sort records are migrated as 1:1 (Actual Output = old Bags), preserving existing inventory behaviour.

ALSO INCLUDED
- 5-minute inactivity auto sign-out clears the password fields held by the FGMS page.
- Supervisor frontend permissions align with the existing database policies for Production/Re-sort/Delivery.

SUPABASE
Run UPDATE_DATABASE_BUILD4_4_RESORT.txt ONCE before deploying the web files.
This is an incremental update and does not delete existing data.

GITHUB ROOT - upload/replace these 8 web files:
1. index.html
2. manifest.json
3. sw.js
4. app.css
5. qc.css
6. fgms-core.js
7. qc.js
8. session-timeout.js

Do NOT upload UPDATE_DATABASE_BUILD4_4_RESORT.txt as a website file; paste it into Supabase SQL Editor and run it once.
