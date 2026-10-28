import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvedDnsPollsBridgeUrl } from '../src/events/bridgeEndpoint.ts';

test('accept canonical DNS Core Cloud Functions bridge URLs in EU regions only', () => {
  assert.equal(
    approvedDnsPollsBridgeUrl('https://europe-west8-dns-core.cloudfunctions.net/pollsBridgeApi'),
    'https://europe-west8-dns-core.cloudfunctions.net/pollsBridgeApi',
  );
  assert.equal(
    approvedDnsPollsBridgeUrl('https://europe-west1-dns-core.cloudfunctions.net/pollsBridgeApi'),
    'https://europe-west1-dns-core.cloudfunctions.net/pollsBridgeApi',
  );
});

test('reject alternate projects, domains, paths, credentials and query parameters', () => {
  for (const url of [
    '',
    'https://example.com/pollsBridgeApi',
    'https://pollsbridgeapi-xyz-ew.a.run.app',
    'https://europe-west8-evil.cloudfunctions.net/pollsBridgeApi',
    'https://europe-west8-dns-core.cloudfunctions.net.attacker.example/pollsBridgeApi',
    'https://europe-west8-dns-core.cloudfunctions.net/pollsBridgeApi?redirect=evil',
    'https://europe-west8-dns-core.cloudfunctions.net/pollsBridgeApi#token',
    'https://user:pass@europe-west8-dns-core.cloudfunctions.net/pollsBridgeApi',
    'https://europe-west8-dns-core.cloudfunctions.net/other',
    'http://europe-west8-dns-core.cloudfunctions.net/pollsBridgeApi',
    'http://localhost:5001/dns-core/europe-west8/pollsBridgeApi',
    'https://us-central1-dns-core.cloudfunctions.net/pollsBridgeApi',
    'javascript:alert(1)',
  ]) {
    assert.throws(() => approvedDnsPollsBridgeUrl(url), /DNS_POLLS_BRIDGE_INVALID_URL/, url);
  }
});
