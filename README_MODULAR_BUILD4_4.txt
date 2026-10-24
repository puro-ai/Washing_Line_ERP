Glowmore FGMS Cloud Build 4.4 MODULAR FLAT

PURPOSE
This build keeps the same Build 4.4 business logic, but separates stable modules so future changes can be made without editing unrelated modules.

SOURCE CODE FILES
- fgms-core.js       Shared Supabase client, state, auth, role UI, realtime and shared data loading.
- production.js      PRODUCTION: Production Entry, Settings and Re-sort.
- inventory.js       INVENTORY: Finished Goods calculations and display.
- delivery.js        DELIVERY: Delivery Record and stock validation.
- qc.js              QUALITY CONTROL: QC Project Setup, QC Entry, QC Files, exports.
- administrator.js   ADMINISTRATOR: User Management and Audit Log.
- session-timeout.js Shared 5-minute inactivity logout.
- app.js             App startup, navigation, login/register UI and module initialization.
- app.css / qc.css   Shared UI and QC-specific styling.

IMPORTANT
When changing Production later, edit production.js first.
When changing Finished Goods, edit inventory.js first.
When changing Delivery, edit delivery.js first.
When changing QC, edit qc.js first.
When changing User Management/Audit, edit administrator.js first.
Avoid modifying other module files unless a shared dependency truly needs to change.

GITHUB
This remains a FLAT structure: all files stay in the repository root; no folders are required.

SUPABASE
This refactor does NOT change database tables or columns. Use UPDATE_DATABASE_BUILD4_4_RESORT.txt only if the Build 4.4 Re-sort database update has not already been executed.
