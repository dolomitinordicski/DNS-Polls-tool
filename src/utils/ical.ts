import { Poll } from '../types';
import { Language } from './i18n';

export interface ICalExportOptions {
  lang?: Language;
  attendeeEmails?: string[];
}

function escapeICalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function escapeICalParam(value: string): string {
  return value.replace(/[",;:]/g, ' ').trim();
}

function normalizeUrl(value?: string): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function compactTimestamp(date = new Date()): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function sanitizeAttendees(emails: string[] = []): string[] {
  const unique = new Set<string>();

  emails
    .map(email => email.trim().toLowerCase())
    .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    .forEach(email => unique.add(email));

  return [...unique];
}

function nextCalendarDay(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const next = new Date(year, month - 1, day + 1);

  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('');
}

function getConferenceUrl(poll: Poll): string {
  const explicit = normalizeUrl(poll.conferenceUrl);
  if (explicit) return explicit;

  const location = (poll.location || '').trim();
  if (/^https?:\/\//i.test(location)) return location;

  return '';
}

export function buildICalContent(
  poll: Poll,
  slotId: string,
  options: ICalExportOptions = {},
): string | null {
  const slot = poll.slots.find(item => item.id === slotId);
  if (!slot) return null;

  const lang = options.lang || 'de';
  const attendees = sanitizeAttendees(options.attendeeEmails);
  const organizerEmail = (poll.organizerEmail || '').trim().toLowerCase();
  const conferenceUrl = getConferenceUrl(poll);
  const isOnline =
    /online|teams|zoom|meet|videokonferenz|video.?conference/i.test(
      poll.location || '',
    ) || Boolean(conferenceUrl);

  const location = isOnline
    ? (conferenceUrl ? 'Online' : (poll.location || 'Online'))
    : (poll.location || '');

  const dateCompact = slot.date.replace(/-/g, '');
  const rangeMatch = (slot.time || '').match(
    /(\d{1,2}):(\d{2})\s*(?:-|–|—)\s*(\d{1,2}):(\d{2})/,
  );
  const isAllDay =
    !rangeMatch ||
    /ganzt|tutto il giorno|all day/i.test(slot.time || '');

  const thankYou =
    lang === 'it'
      ? 'Grazie per aver indicato la tua disponibilità. Questo è l’appuntamento definitivo.'
      : 'Vielen Dank für Ihre Rückmeldung. Dies ist der endgültig bestätigte Termin.';

  const descriptionParts = [
    thankYou,
    poll.description || '',
    `${lang === 'it' ? 'Organizzato da' : 'Organisiert von'} ${poll.organizerName}`,
  ].filter(Boolean);

  if (conferenceUrl) {
    descriptionParts.push(
      `${lang === 'it' ? 'Videoconferenza' : 'Videokonferenz'}: ${conferenceUrl}`,
    );
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    attendees.length > 0 ? 'METHOD:REQUEST' : 'METHOD:PUBLISH',
    'PRODID:-//Dolomiti NordicSki//DNS Polls//DE',
  ];

  if (!isAllDay) {
    lines.push(
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Rome',
      'X-LIC-LOCATION:Europe/Rome',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0200',
      'TZNAME:CEST',
      'DTSTART:19700329T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'TZNAME:CET',
      'DTSTART:19701025T030000',
      'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
      'END:STANDARD',
      'END:VTIMEZONE',
    );
  }

  lines.push(
    'BEGIN:VEVENT',
    `UID:${poll.id}-${slot.id}@dolomitinordicski.com`,
    `DTSTAMP:${compactTimestamp()}`,
    `LAST-MODIFIED:${compactTimestamp()}`,
    'SEQUENCE:0',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    `SUMMARY:${escapeICalText(poll.title)}`,
  );

  if (isAllDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateCompact}`);
    lines.push(`DTEND;VALUE=DATE:${nextCalendarDay(slot.date)}`);
  } else if (rangeMatch) {
    const startTime =
      String(rangeMatch[1]).padStart(2, '0') + rangeMatch[2] + '00';
    const endTime =
      String(rangeMatch[3]).padStart(2, '0') + rangeMatch[4] + '00';

    lines.push(
      `DTSTART;TZID=Europe/Rome:${dateCompact}T${startTime}`,
      `DTEND;TZID=Europe/Rome:${dateCompact}T${endTime}`,
    );
  }

  if (location) {
    lines.push(`LOCATION:${escapeICalText(location)}`);
  }

  if (organizerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organizerEmail)) {
    lines.push(
      `ORGANIZER;CN=${escapeICalParam(poll.organizerName)}:mailto:${organizerEmail}`,
    );
  }

  attendees.forEach(email => {
    lines.push(
      `ATTENDEE;CN=${escapeICalParam(email)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${email}`,
    );
  });

  if (conferenceUrl) {
    lines.push(`URL:${conferenceUrl}`);
    lines.push(`CONFERENCE;VALUE=URI:${conferenceUrl}`);
  }

  lines.push(
    `DESCRIPTION:${escapeICalText(descriptionParts.join('\n\n'))}`,
    'X-MICROSOFT-CDO-BUSYSTATUS:BUSY',
    'END:VEVENT',
    'END:VCALENDAR',
  );

  return lines.join('\r\n');
}
