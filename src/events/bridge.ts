import { dnsCoreAuth } from '../lib/dnsCore';
import type { DNSEvent } from './types';
import { approvedDnsPollsBridgeUrl } from './bridgeEndpoint';

export const eventsBridgeEnabled = Boolean(import.meta.env.VITE_DNS_POLLS_BRIDGE_URL?.trim());

function bridgeUrl(): string {
  const base = import.meta.env.VITE_DNS_POLLS_BRIDGE_URL?.trim() || '';
  return approvedDnsPollsBridgeUrl(base);
}

async function bridgeRequest<T>(action: string, event?: unknown): Promise<T> {
  const user = dnsCoreAuth.currentUser;
  if (!user) throw new Error('DNS_CORE_LOGIN_REQUIRED');
  const response = await fetch(bridgeUrl(), {
    method: 'POST', mode: 'cors', cache: 'no-store', credentials: 'omit', redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + await user.getIdToken(),
    },
    body: JSON.stringify({ action, ...(event === undefined ? {} : { event }) }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || 'DNS_POLLS_BRIDGE_UNAVAILABLE');
  }
  return response.json() as Promise<T>;
}

export async function managedEventsList(): Promise<DNSEvent[]> {
  const result = await bridgeRequest<{ events: DNSEvent[] }>('events.list');
  return result.events;
}

export async function managedEventCreate(
  event: Omit<DNSEvent, 'id' | 'createdAt' | 'schemaVersion'>,
): Promise<DNSEvent> {
  const { title, description, location, startsAt, questions } = event;
  const result = await bridgeRequest<{ event: DNSEvent }>(
    'events.create', { title, description, location, startsAt, questions },
  );
  return result.event;
}
