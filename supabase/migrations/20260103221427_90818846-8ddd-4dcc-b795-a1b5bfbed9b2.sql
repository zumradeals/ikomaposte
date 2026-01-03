-- Add RLS policy to allow anonymous device trust verification
-- This allows the kiosk to verify if a device is enrolled without admin auth

CREATE POLICY "Allow anonymous device trust check" 
ON public.devices 
FOR SELECT 
USING (true);

-- Drop the existing admin-only SELECT policy first (if exists)
DROP POLICY IF EXISTS "Devices are readable by admins only" ON public.devices;