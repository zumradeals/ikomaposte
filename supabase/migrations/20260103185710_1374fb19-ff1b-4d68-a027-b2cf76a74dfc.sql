-- Create devices table for trusted device enrollment
CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE NOT NULL,
  device_secret text UNIQUE NOT NULL,
  label text NULL,
  site_id text NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- RLS policies for devices
CREATE POLICY "Devices are readable by admins only"
ON public.devices
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert devices"
ON public.devices
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update devices"
ON public.devices
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_devices_updated_at
BEFORE UPDATE ON public.devices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enrich work_events with trust columns
ALTER TABLE public.work_events
ADD COLUMN device_secret text NULL,
ADD COLUMN trust_status text NOT NULL DEFAULT 'untrusted',
ADD COLUMN trust_reason text NULL,
ADD COLUMN client_occurred_at timestamptz NULL;

-- Add index for trust status filtering
CREATE INDEX idx_work_events_trust_status ON public.work_events(trust_status);
CREATE INDEX idx_devices_device_id ON public.devices(device_id);
CREATE INDEX idx_devices_device_secret ON public.devices(device_secret);