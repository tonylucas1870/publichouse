import { DebugLogger } from './debugUtils.js';

/**
 * Parses an ICS file and extracts booking information
 * @param {string} icsData - Raw ICS file content
 * @returns {Array<{start: Date, end: Date, summary: string, uid: string}>}
 */
export function parseICS(icsData) {
  DebugLogger.log('CalendarUtils', 'Starting ICS parsing');
  
  const bookings = [];
  const lines = icsData.split('\n');
  let currentBooking = null;
  let lineNumber = 0;

  try {
    for (let line of lines) {
      lineNumber++;
      line = line.trim();

      // Start of event
      if (line === 'BEGIN:VEVENT') {
        DebugLogger.log('CalendarUtils', 'Found event start', { lineNumber });
        currentBooking = {};
        continue;
      }

      // End of event
      if (line === 'END:VEVENT') {
        if (currentBooking?.start && currentBooking?.end && currentBooking?.uid) {
          DebugLogger.log('CalendarUtils', 'Adding complete booking', currentBooking);
          bookings.push(currentBooking);
        } else {
          DebugLogger.log('CalendarUtils', 'Skipping incomplete booking', {
            lineNumber,
            booking: currentBooking
          });
        }
        currentBooking = null;
        continue;
      }

      // Skip if not in event
      if (!currentBooking) continue;

      // Parse event properties
      try {
        if (line.startsWith('DTSTART')) {
          currentBooking.start = parseICSDate(line.split(':')[1]);
        } else if (line.startsWith('DTEND')) {
          currentBooking.end = parseICSDate(line.split(':')[1]);
        } else if (line.startsWith('SUMMARY')) {
          currentBooking.summary = line.split(':')[1];
        } else if (line.startsWith('UID')) {
          currentBooking.uid = line.split(':')[1];
        }
      } catch (error) {
        DebugLogger.error('CalendarUtils', 'Error parsing line', {
          lineNumber,
          line,
          error
        });
      }
    }

    DebugLogger.log('CalendarUtils', 'Completed ICS parsing', {
      totalBookings: bookings.length
    });

    return bookings;
  } catch (error) {
    DebugLogger.error('CalendarUtils', 'Failed to parse ICS', error);
    throw error;
  }
}

/**
 * Parses an ICS date string into a JavaScript Date object
 * @param {string} dateStr - ICS format date string
 * @returns {Date}
 */
function parseICSDate(dateStr) {
  DebugLogger.log('CalendarUtils', 'Parsing date', { dateStr });

  try {
    // Handle basic format: YYYYMMDD
    if (dateStr.length === 8) {
      const year = dateStr.slice(0, 4);
      const month = dateStr.slice(4, 6);
      const day = dateStr.slice(6, 8);
      return new Date(Date.UTC(year, month - 1, day));
    }

    // Handle full format: YYYYMMDDTHHmmssZ
    if (dateStr.includes('T')) {
      const [datePart, timePart] = dateStr.split('T');
      const year = datePart.slice(0, 4);
      const month = datePart.slice(4, 6);
      const day = datePart.slice(6, 8);
      const hour = timePart.slice(0, 2);
      const minute = timePart.slice(2, 4);
      const second = timePart.slice(4, 6);
      
      return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    }

    throw new Error('Unsupported date format');
  } catch (error) {
    DebugLogger.error('CalendarUtils', 'Failed to parse date', {
      dateStr,
      error
    });
    throw error;
  }
}

/**
 * Validates a calendar URL
 * @param {string} url 
 * @returns {boolean}
 */
export function isValidCalendarUrl(url) {
  DebugLogger.log('CalendarUtils', 'Validating URL', { url });
  
  try {
    const parsed = new URL(url);
    const isValid = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    
    DebugLogger.log('CalendarUtils', 'URL validation result', {
      url,
      isValid,
      protocol: parsed.protocol
    });
    
    return isValid;
  } catch (error) {
    DebugLogger.error('CalendarUtils', 'URL validation failed', {
      url,
      error
    });
    return false;
  }
}