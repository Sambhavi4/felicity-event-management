/**
 * Calendar Export Utility
 * Generates .ics files for calendar integration
 */

/**
 * Generate ICS file content for an event
 */
export const generateICS = (event, registration = null) => {
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const escapeText = (text) => {
    if (!text) return '';
    return text.replace(/[\\;,\n]/g, (match) => {
      if (match === '\n') return '\\n';
      return '\\' + match;
    });
  };
  
  const uid = registration ? `${registration._id}@felicity.iiit.ac.in` : `${event._id}@felicity.iiit.ac.in`;
  const dtstart = formatDate(event.eventStartDate);
  const dtend = formatDate(event.eventEndDate || new Date(new Date(event.eventStartDate).getTime() + 2 * 60 * 60 * 1000));
  const dtstamp = formatDate(new Date());
  const summary = escapeText(event.name);
  const description = escapeText(event.description);
  const location = escapeText(event.venue || 'TBD');
  const organizer = event.organizer?.organizerName || 'Felicity IIIT Hyderabad';
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Felicity Event Management//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Felicity Events
X-WR-TIMEZONE:Asia/Kolkata
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
DTSTART:${dtstart}
DTEND:${dtend}
SUMMARY:${summary}
DESCRIPTION:${description}
LOCATION:${location}
ORGANIZER;CN=${organizer}:MAILTO:noreply@felicity.iiit.ac.in
STATUS:CONFIRMED
TRANSP:OPAQUE
BEGIN:VALARM
TRIGGER:-PT1H
DESCRIPTION:Event reminder
ACTION:DISPLAY
END:VALARM
END:VEVENT
END:VCALENDAR`;
};

/**
 * Generate ICS for multiple events
 */
export const generateBatchICS = (events) => {
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const escapeText = (text) => {
    if (!text) return '';
    return text.replace(/[\\;,\n]/g, (match) => {
      if (match === '\n') return '\\n';
      return '\\' + match;
    });
  };
  
  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Felicity Event Management//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Felicity Events
X-WR-TIMEZONE:Asia/Kolkata
`;
  
  events.forEach(event => {
    const uid = `${event._id}@felicity.iiit.ac.in`;
    const dtstart = formatDate(event.eventStartDate);
    const dtend = formatDate(event.eventEndDate || new Date(new Date(event.eventStartDate).getTime() + 2 * 60 * 60 * 1000));
    const dtstamp = formatDate(new Date());
    const summary = escapeText(event.name);
    const description = escapeText(event.description);
    const location = escapeText(event.venue || 'TBD');
    const organizer = event.organizer?.organizerName || 'Felicity IIIT Hyderabad';
    
    ics += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
DTSTART:${dtstart}
DTEND:${dtend}
SUMMARY:${summary}
DESCRIPTION:${description}
LOCATION:${location}
ORGANIZER;CN=${organizer}:MAILTO:noreply@felicity.iiit.ac.in
STATUS:CONFIRMED
TRANSP:OPAQUE
BEGIN:VALARM
TRIGGER:-PT1H
DESCRIPTION:Event reminder
ACTION:DISPLAY
END:VALARM
END:VEVENT
`;
  });
  
  ics += 'END:VCALENDAR';
  return ics;
};

/**
 * Generate Google Calendar URL
 */
export const generateGoogleCalendarURL = (event) => {
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  const baseURL = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const params = new URLSearchParams({
    text: event.name,
    details: event.description || '',
    location: event.venue || '',
    dates: `${formatDate(event.eventStartDate)}/${formatDate(event.eventEndDate || new Date(new Date(event.eventStartDate).getTime() + 2 * 60 * 60 * 1000))}`
  });
  
  return `${baseURL}&${params.toString()}`;
};

/**
 * Generate Outlook Calendar URL
 */
export const generateOutlookCalendarURL = (event) => {
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toISOString();
  };
  
  const baseURL = 'https://outlook.live.com/calendar/0/deeplink/compose';
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.name,
    body: event.description || '',
    location: event.venue || '',
    startdt: formatDate(event.eventStartDate),
    enddt: formatDate(event.eventEndDate || new Date(new Date(event.eventStartDate).getTime() + 2 * 60 * 60 * 1000))
  });
  
  return `${baseURL}?${params.toString()}`;
};
