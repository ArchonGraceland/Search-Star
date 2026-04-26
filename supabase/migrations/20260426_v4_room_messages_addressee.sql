-- Companion v2: explicit addressee on Companion-authored room_messages.
--
-- Why. The followup trigger at src/app/api/rooms/[id]/messages/route.ts
-- needs to know who a Companion question was for, so it can fire only
-- when that specific practitioner replies. Commit 79ad074 ships an
-- implicit-addressee gate that uses the Companion row's user_id (which
-- is set to the practitioner who triggered the response). That works
-- for the Rick/David failure but is wrong for room-wide questions and
-- for any future Companion utterance addressed to a non-trigger user.
-- This column makes the addressee explicit and lets the gate read it
-- directly. Background: docs/companion-v2-scope.md §6 and §7 item 2.
--
-- Shape. Nullable, FK to profiles, only settable on Companion-authored
-- rows. Practitioner / sponsor rows must keep it null — the column is
-- a Companion-side annotation, not a user-facing addressing mechanism.

ALTER TABLE room_messages
  ADD COLUMN addressee_user_id uuid
  REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE room_messages
  DROP CONSTRAINT IF EXISTS room_messages_addressee_only_on_companion;
ALTER TABLE room_messages
  ADD CONSTRAINT room_messages_addressee_only_on_companion
  CHECK (
    addressee_user_id IS NULL
    OR message_type IN (
      'companion_response',
      'companion_welcome',
      'companion_milestone',
      'companion_moderation'
    )
  );

CREATE INDEX IF NOT EXISTS idx_room_messages_addressee
  ON room_messages(addressee_user_id)
  WHERE addressee_user_id IS NOT NULL;
