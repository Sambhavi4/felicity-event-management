/**
 * QR Code Utility
 * 
 * WHY QR CODES?
 * - Fast check-in at events (scan instead of manual lookup)
 * - Reduces fraud (unique codes hard to replicate)
 * - Works offline (organizer app can validate without internet)
 * 
 * QR DATA STRUCTURE:
 * - Contains minimal data for validation
 * - Includes ticket ID, event ID, participant ID
 * - JSON format for easy parsing
 */

import QRCode from 'qrcode';

/**
 * Generate QR code for a registration ticket
 * 
 * @param {Object} registration - Registration document
 * @param {Object} event - Event document
 * @param {Object} participant - Participant document
 * @returns {Promise<string>} - Base64 data URL of QR code
 * 
 * DATA ENCODED:
 * - ticketId: For display and manual lookup
 * - eventId: To verify ticket is for correct event
 * - participantId: To identify the attendee
 * - type: 'normal' or 'merchandise' for different handling
 */
export const generateTicketQR = async (registration, event, participant) => {
  const qrData = {
    ticketId: registration.ticketId,
    eventId: event._id.toString(),
    eventName: event.name,
    participantId: participant._id.toString(),
    participantName: `${participant.firstName} ${participant.lastName}`,
    type: registration.registrationType,
    timestamp: Date.now()
  };
  
  try {
    // Generate QR as data URL (base64 encoded PNG)
    // This can be directly used in <img> tags
    const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: 'M', // Medium error correction (15%)
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    return qrCodeDataUrl;
    
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Validate QR code data
 * Checks if the QR data is valid and not tampered
 */
export const validateQRData = (qrData, eventId) => {
  try {
    const data = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    
    // Validate required fields
    if (!data.ticketId || !data.eventId || !data.participantId) {
      return { valid: false, error: 'Invalid QR code data' };
    }
    
    // Validate event match
    if (data.eventId !== eventId.toString()) {
      return { valid: false, error: 'Ticket is for a different event' };
    }
    
    return { valid: true, data };
    
  } catch (error) {
    return { valid: false, error: 'Could not parse QR code' };
  }
};
