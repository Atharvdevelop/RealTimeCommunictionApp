/*
# PulseMeet: rooms and chat messages

1. New Tables
- `rooms`: a meeting room identified by a unique short code (e.g. pulse-849-xyz).
  - `id` uuid PK
  - `code` text unique not null (the shareable room code)
  - `password` text nullable (optional passcode)
  - `host_name` text not null (display name of creator)
  - `created_at` timestamptz
- `messages`: in-room chat messages.
  - `id` uuid PK
  - `room_id` uuid FK -> rooms.id ON DELETE CASCADE
  - `sender_id` text not null (random per-session guest id)
  - `sender_name` text not null
  - `content` text not null
  - `created_at` timestamptz

2. Security
- Enable RLS on both tables.
- Guest/no-auth app: anon + authenticated full CRUD because room data is intentionally
  shared among all participants of a room (anyone with the code joins).

3. Notes
- Presence (who is online, cursors, whiteboard strokes) is handled via Supabase
  Realtime channels in-memory, NOT persisted to a table.
*/

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  password text,
  host_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_select_all" ON rooms;
CREATE POLICY "rooms_select_all" ON rooms FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "rooms_insert_all" ON rooms;
CREATE POLICY "rooms_insert_all" ON rooms FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rooms_update_all" ON rooms;
CREATE POLICY "rooms_update_all" ON rooms FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rooms_delete_all" ON rooms;
CREATE POLICY "rooms_delete_all" ON rooms FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  sender_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_all" ON messages;
CREATE POLICY "messages_select_all" ON messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "messages_insert_all" ON messages;
CREATE POLICY "messages_insert_all" ON messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "messages_update_all" ON messages;
CREATE POLICY "messages_update_all" ON messages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "messages_delete_all" ON messages;
CREATE POLICY "messages_delete_all" ON messages FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS messages_room_created_idx
  ON messages (room_id, created_at);
