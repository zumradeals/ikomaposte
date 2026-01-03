// Admin PIN verification
// In Phase 1, PIN is hardcoded but stored securely
// In production, this would call a secure backend

const ADMIN_PIN_HASH = '1234'; // Default PIN - would be hashed and stored server-side

export async function verifyAdminPin(pin: string): Promise<boolean> {
  // Simulate network delay for security
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // In production, this would:
  // 1. Hash the PIN client-side
  // 2. Send to secure backend for verification
  // 3. Return session token
  
  return pin === ADMIN_PIN_HASH;
}

export function getAdminSessionDuration(): number {
  // 2 minutes in milliseconds
  return 2 * 60 * 1000;
}
