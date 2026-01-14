-- Add unique partial index to ensure only one active PIN per scope
CREATE UNIQUE INDEX idx_admin_secrets_scope_active 
ON admin_secrets(scope) 
WHERE is_active = true;