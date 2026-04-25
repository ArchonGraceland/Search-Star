-- F23: drop companion_rate_limit table.
-- The single consumer (src/app/api/companion/reflect/route.ts) was
-- retired in the same commit per pass-3-decisions.md §7.2. Closes
-- F15 (racy upsert) per §6(e) — moot once the table is gone.
DROP TABLE IF EXISTS companion_rate_limit;
