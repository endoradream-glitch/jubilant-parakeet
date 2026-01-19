-- Create authorization_requests table
CREATE TABLE IF NOT EXISTS authorization_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL UNIQUE,
  device_info JSONB,
  request_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by TEXT,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Create authorized_devices table
CREATE TABLE IF NOT EXISTS authorized_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL UNIQUE,
  device_info JSONB,
  confirmation_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  device_type TEXT CHECK (device_type IN ('patrol', 'hq')),
  authorized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  authorized_by TEXT
);

-- Create authorization_logs table for audit trail
CREATE TABLE IF NOT EXISTS authorization_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE authorization_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorization_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now - we'll control access via app logic)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'authorization_requests' AND policyname = 'Allow all operations on authorization_requests') THEN
        CREATE POLICY "Allow all operations on authorization_requests" ON authorization_requests FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'authorized_devices' AND policyname = 'Allow all operations on authorized_devices') THEN
        CREATE POLICY "Allow all operations on authorized_devices" ON authorized_devices FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'authorization_logs' AND policyname = 'Allow all operations on authorization_logs') THEN
        CREATE POLICY "Allow all operations on authorization_logs" ON authorization_logs FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auth_requests_device_id ON authorization_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_auth_requests_status ON authorization_requests(status);
CREATE INDEX IF NOT EXISTS idx_auth_devices_device_id ON authorized_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_auth_devices_confirmation_code ON authorized_devices(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_auth_logs_device_id ON authorization_logs(device_id);