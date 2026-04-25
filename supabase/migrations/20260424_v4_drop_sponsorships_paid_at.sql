-- Pass 3b Cluster 1 (Q1 = Option B with paid_at dropped):
-- Retire the sponsorships.paid_at column. Under v4 Decision #5
-- ('Payment release is the attestation'), the released-then-paid
-- two-state model collapses to a single 'released' terminal state.
-- The release-action route synchronously captures the PaymentIntent
-- and only advances status to 'released' if capture returns success;
-- the webhook's confirmation echo into 'paid' was solving a problem
-- the v4 model does not have.
--
-- Production state at apply time: zero rows with paid_at IS NOT NULL.
-- Drop is destructive but loses no information.

ALTER TABLE sponsorships DROP COLUMN paid_at;
