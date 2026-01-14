// ============================================
// IKOMA POSTE - QR Code Verification URL Generator
// ============================================
// DOCTRINE: QR Code contains ONLY a verification URL
// NO sensitive data, NO business data
// The server is the ONLY source of truth
// ============================================

/**
 * Base URL for document verification
 * In production, this will be the published app URL
 */
const getVerificationBaseUrl = (): string => {
  // Use published URL if available, otherwise preview
  if (typeof window !== 'undefined') {
    const host = window.location.host;
    // Check if we're on a Lovable domain
    if (host.includes('lovable.app')) {
      // Use the ikomaposte.lovable.app for published URLs
      return 'https://ikomaposte.lovable.app';
    }
    // Fallback to current origin for development
    return window.location.origin;
  }
  // Server-side fallback
  return 'https://ikomaposte.lovable.app';
};

/**
 * Generate verification URL for a document
 * This URL is what gets encoded in the QR code
 * 
 * @param documentCode - The unique document code (e.g., IKP-RAP-202506-014)
 * @returns Full verification URL
 */
export function generateVerificationUrl(documentCode: string): string {
  const baseUrl = getVerificationBaseUrl();
  // URL format: /verify/{document_code}
  // Example: https://ikomaposte.lovable.app/verify/IKP-RAP-202506-014
  return `${baseUrl}/verify/${encodeURIComponent(documentCode)}`;
}

/**
 * Generate verification URL by document ID (alternative)
 * Used when document_code might not be available
 * 
 * @param documentId - The UUID of the document
 * @returns Full verification URL with ID as query param
 */
export function generateVerificationUrlById(documentId: string): string {
  const baseUrl = getVerificationBaseUrl();
  return `${baseUrl}/verify?id=${encodeURIComponent(documentId)}`;
}

/**
 * Generate the text content for QR code
 * IMPORTANT: Only contains URL, no sensitive data
 * 
 * @param documentCode - The document code
 * @returns URL string to encode in QR code
 */
export function getQrCodeContent(documentCode: string): string {
  return generateVerificationUrl(documentCode);
}

/**
 * Validate if a string looks like a valid document code
 * Format: IKP-{TYPE}-{YYYYMM}-{SEQ}
 */
export function isValidDocumentCode(code: string): boolean {
  const pattern = /^IKP-(RAP|PTG)-\d{6}-\d{3,}$/;
  return pattern.test(code);
}
