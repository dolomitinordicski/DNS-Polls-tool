import {
  initDNSFoundation,
  type DNSFoundationRuntimeHandle,
} from '@dolomitinordicski/dns-shared-data/foundation';
import type { DNSCapabilityAdapter } from '@dolomitinordicski/dns-shared-data/capability-runtime';
import { DNS_FOUNDATION_RELEASE_VERSION } from '@dolomitinordicski/dns-shared-data/release';
import type { Poll } from '../types';
import QRCode from 'qrcode';
import { buildICalContent, type ICalExportOptions } from '../utils/ical';

export type DNSPollsLanguage = 'de' | 'it';

type PollsICSPayload = {
  poll: Poll;
  slotId: string;
  options?: ICalExportOptions;
};

const foundationAssets =
  `https://raw.githubusercontent.com/dolomitinordicski/dns-shared-data/foundation-v${DNS_FOUNDATION_RELEASE_VERSION}/brand`;

export const DNS_POLLS_FOUNDATION_VERSION = DNS_FOUNDATION_RELEASE_VERSION;
export const DNS_POLLS_WEB_LOGO_URL = `${foundationAssets}/logo-web.png`;

const icsAdapter: DNSCapabilityAdapter<PollsICSPayload> = {
  id: 'dns-polls-ics',
  capabilities: ['calendar.ics'],
  execute({ poll, slotId, options }) {
    const content = buildICalContent(poll, slotId, options);
    if (!content) return { downloaded: false };

    const filename = `${poll.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.ics`;

    if (
      typeof document === 'undefined' ||
      typeof URL === 'undefined' ||
      typeof Blob === 'undefined'
    ) {
      return { downloaded: false, filename, content };
    }

    const blob = new Blob([content], {
      type: 'text/calendar;charset=utf-8;method=REQUEST',
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    queueMicrotask(() => URL.revokeObjectURL(href));

    return { downloaded: true, filename, size: blob.size };
  },
};

const qrAdapter: DNSCapabilityAdapter<
  { value: string; size?: number },
  { dataUrl: string }
> = {
  id: 'dns-polls-qr',
  capabilities: ['qr.generate'],
  async execute({ value, size = 220 }) {
    return {
      dataUrl: await QRCode.toDataURL(value, {
        width: size,
        margin: 1,
      }),
    };
  },
};

let foundation: DNSFoundationRuntimeHandle | null = null;

export function initDNSPollsFoundation(language?: DNSPollsLanguage) {
  if (!foundation) {
    foundation = initDNSFoundation({
      language,
      shellProfile: 'operational',
      capabilities: ['calendar.ics', 'clipboard.copy', 'qr.generate'],
      capabilityAdapters: [icsAdapter, qrAdapter],
      accessibility: {
        enabled: true,
        mountSelector: '[data-dns-accessibility-mount]',
        storageKey: 'dns-accessibility-v1',
      },
    });
  } else if (language && foundation.getLanguage() !== language) {
    foundation.setLanguage(language);
  }

  return foundation;
}

export function getDNSPollsLanguage(): DNSPollsLanguage {
  return initDNSPollsFoundation().getLanguage();
}

export function setDNSPollsLanguage(language: DNSPollsLanguage) {
  initDNSPollsFoundation().setLanguage(language);
}

export function subscribeDNSPollsLanguage(
  listener: (language: DNSPollsLanguage) => void,
) {
  return initDNSPollsFoundation().subscribeLanguage(listener);
}

export const dnsPollsCapabilities = {
  run<T = unknown>(
    capability: 'calendar.ics' | 'clipboard.copy' | 'qr.generate',
    input?: unknown,
  ) {
    return initDNSPollsFoundation().capabilityRuntime.run<T>(capability, input);
  },
};
