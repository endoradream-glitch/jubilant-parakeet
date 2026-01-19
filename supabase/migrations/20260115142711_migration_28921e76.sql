-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create patrols table
CREATE TABLE IF NOT EXISTS patrols (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patrol_id TEXT UNIQUE NOT NULL,
  code TEXT NOT NULL,
  ptl_name TEXT NOT NULL,
  comd TEXT NOT NULL,
  str TEXT NOT NULL,
  wpn TEXT NOT NULL,
  ammo TEXT NOT NULL,
  purpose TEXT NOT NULL,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patrol_id TEXT NOT NULL REFERENCES patrols(patrol_id),
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  accuracy FLOAT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_patrols_patrol_id ON patrols(patrol_id);
CREATE INDEX IF NOT EXISTS idx_patrols_status ON patrols(status);
CREATE INDEX IF NOT EXISTS idx_locations_patrol_id ON locations(patrol_id);

-- Enable Row Level Security
ALTER TABLE patrols ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now)
-- We use DO blocks to avoid errors if policies already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'patrols' AND policyname = 'Allow all operations on patrols'
    ) THEN
        CREATE POLICY "Allow all operations on patrols" ON patrols FOR ALL USING (true) WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'locations' AND policyname = 'Allow all operations on locations'
    ) THEN
        CREATE POLICY "Allow all operations on locations" ON locations FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;