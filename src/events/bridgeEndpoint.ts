/** Fail closed before transmitting a DNS Core Firebase ID token.
 * Only the canonical DNS Core Cloud Functions endpoint is trusted.
 * Github Pages build variables are configuration, not proof of trust. */
export function approvedDnsPollsBridgeUrl(value: string): string {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error('DNS_POLLS_BRIDGE_INVALID_URL');
  }
  const approvedHost = /^europe-[a-z]+[1-9][0-9]*-dns-core\.cloudfunctions\.net$/;
  if (endpoint.protocol !== 'https:' ||
      !approvedHost.test(endpoint.hostname) ||
      endpoint.pathname !== '/pollsBridgeApi' ||
      endpoint.port !== '' ||
      endpoint.username !== '' ||
      endpoint.password !== '' ||
      endpoint.search !== '' ||
      endpoint.hash !== '') {
    throw new Error('DNS_POLLS_BRIDGE_INVALID_URL');
  }
  return endpoint.href;
}
