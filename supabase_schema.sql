-- ============================================================
--  Smart Composter — Supabase Schema
--  Upload this file via Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- Enable pgcrypto for gen_random_bytes & gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ------------------------------------------------------------
--  devices
--  One row per physical ESP32 device.
--  api_key  → sent by ESP32 in X-API-Key header
--  user_id  → links to Supabase Auth user (set when auth added)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   TEXT        UNIQUE NOT NULL,
  api_key     TEXT        UNIQUE NOT NULL DEFAULT ('sk_' || encode(gen_random_bytes(32), 'hex')),
  name        TEXT        NOT NULL DEFAULT 'My Composter',
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ
);


-- ------------------------------------------------------------
--  telemetry_logs
--  Written every 60 s from the backend when ESP32 is online.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telemetry_logs (
  id                BIGSERIAL    PRIMARY KEY,
  device_id         TEXT         NOT NULL DEFAULT 'default',
  timestamp         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  mode              TEXT,
  phase             TEXT,
  auto_mode         BOOLEAN,
  core_temp         DOUBLE PRECISION,
  air_temp_avg      DOUBLE PRECISION,
  air_humidity_avg  DOUBLE PRECISION,
  soil_percent      DOUBLE PRECISION,
  gas_raw           INTEGER,
  soil_raw          INTEGER,
  dht1_temp         DOUBLE PRECISION,
  dht2_temp         DOUBLE PRECISION,
  dht1_humidity     DOUBLE PRECISION,
  dht2_humidity     DOUBLE PRECISION,
  dht1_valid        BOOLEAN,
  dht2_valid        BOOLEAN,
  ds18b20_valid     BOOLEAN,
  soil_valid        BOOLEAN,
  gas_valid         BOOLEAN,
  heater            BOOLEAN,
  fan               BOOLEAN,
  pump              BOOLEAN,
  servo             TEXT,
  wifi              TEXT,
  last_event        TEXT
);


-- ------------------------------------------------------------
--  event_logs
--  Written on every state-change event pushed from the device.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_logs (
  id         BIGSERIAL    PRIMARY KEY,
  device_id  TEXT         NOT NULL DEFAULT 'default',
  timestamp  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  event      TEXT         NOT NULL,
  mode       TEXT,
  phase      TEXT
);


-- ------------------------------------------------------------
--  Indexes for fast per-device time-ordered queries
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_telemetry_device_ts
  ON telemetry_logs (device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_events_device_ts
  ON event_logs (device_id, timestamp DESC);


-- ------------------------------------------------------------
--  Row Level Security
--  Backend uses service_role key → bypasses RLS automatically.
--  Policies below are placeholders for future frontend direct-
--  access or Supabase Auth integration.
-- ------------------------------------------------------------
ALTER TABLE devices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs     ENABLE ROW LEVEL SECURITY;

-- Service role always bypasses RLS — no extra policy needed.

CREATE POLICY "user sees own devices"
  ON devices FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user updates own devices"
  ON devices FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "user sees own telemetry"
  ON telemetry_logs FOR SELECT
  USING (device_id IN (
    SELECT device_id FROM devices WHERE user_id = auth.uid()
  ));

CREATE POLICY "user sees own events"
  ON event_logs FOR SELECT
  USING (device_id IN (
    SELECT device_id FROM devices WHERE user_id = auth.uid()
  ));


-- ------------------------------------------------------------
--  Seed: default device (used before multi-device is wired up)
--  The api_key printed here can be copied to .env as DEFAULT_API_KEY
-- ------------------------------------------------------------
INSERT INTO devices (device_id, name)
VALUES (gen_random_uuid()::TEXT, 'Default Composter')
ON CONFLICT (device_id) DO NOTHING;

-- After running, update existing devices with old api_key format:
-- UPDATE devices SET api_key = 'sk_' || api_key WHERE api_key NOT LIKE 'sk_%';


-- ------------------------------------------------------------
--  Migration: add calibration column
--  Run this if the devices table already exists without it.
-- ------------------------------------------------------------
ALTER TABLE devices ADD COLUMN IF NOT EXISTS calibration JSONB NOT NULL DEFAULT '{}';


-- ------------------------------------------------------------
--  schedules
--  Automated actuator schedules executed by backend cron.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id       TEXT        NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  action          JSONB       NOT NULL DEFAULT '{}',
  duration_sec    INT,
  start_time      TIME        NOT NULL,
  recurrence      TEXT        NOT NULL DEFAULT 'once',
  days_of_week    INT[]       NOT NULL DEFAULT '{}',
  run_date        DATE,
  enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_user_device
  ON schedules (user_id, device_id, enabled);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user sees own schedules"
  ON schedules FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user inserts own schedules"
  ON schedules FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user updates own schedules"
  ON schedules FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "user deletes own schedules"
  ON schedules FOR DELETE USING (user_id = auth.uid());


-- ------------------------------------------------------------
--  user_settings
--  One row per user (upserted on first GET).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
  user_id               UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name          TEXT,
  notify_email          BOOLEAN     NOT NULL DEFAULT TRUE,
  notify_push           BOOLEAN     NOT NULL DEFAULT FALSE,
  alert_temp_max        NUMERIC     NOT NULL DEFAULT 70,
  alert_temp_min        NUMERIC     NOT NULL DEFAULT 30,
  alert_humidity_min    NUMERIC     NOT NULL DEFAULT 30,
  quiet_hours_start     TIME,
  quiet_hours_end       TIME,
  default_device_id     TEXT        REFERENCES devices(device_id) ON DELETE SET NULL,
  history_retention_days INT        NOT NULL DEFAULT 90,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user sees own settings"
  ON user_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user modifies own settings"
  ON user_settings FOR ALL USING (user_id = auth.uid());


-- ------------------------------------------------------------
--  schedule_runs  — audit log of every scheduled execution
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedule_runs (
  id           BIGSERIAL   PRIMARY KEY,
  schedule_id  UUID        REFERENCES schedules(id) ON DELETE CASCADE,
  ran_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ok           BOOLEAN,
  message      TEXT
);

ALTER TABLE schedule_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user sees own schedule runs"
  ON schedule_runs FOR SELECT
  USING (
    schedule_id IN (
      SELECT id FROM schedules WHERE user_id = auth.uid()
    )
  );
