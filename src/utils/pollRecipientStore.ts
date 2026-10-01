const STORAGE_KEY = 'dns_polls_poll_recipients_v1';

type RecipientMap = Record<string, string[]>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readRecipientMap(): RecipientMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Could not read poll recipient store:', error);
    return {};
  }
}

function writeRecipientMap(value: RecipientMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    console.error('Could not save poll recipient store:', error);
  }
}

export function parseRecipientEmails(value: string): string[] {
  const unique = new Set<string>();

  value
    .split(/[\n,;\s]+/)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
    .forEach(email => {
      if (EMAIL_PATTERN.test(email)) unique.add(email);
    });

  return [...unique];
}

export function getPollRecipients(pollId: string): string[] {
  return readRecipientMap()[pollId] || [];
}

export function savePollRecipients(
  pollId: string,
  emails: string[] | string,
): string[] {
  const normalized = Array.isArray(emails)
    ? parseRecipientEmails(emails.join('\n'))
    : parseRecipientEmails(emails);

  const store = readRecipientMap();

  if (normalized.length === 0) {
    delete store[pollId];
  } else {
    store[pollId] = normalized;
  }

  writeRecipientMap(store);
  return normalized;
}

export function formatPollRecipients(emails: string[]): string {
  return emails.join('\n');
}
