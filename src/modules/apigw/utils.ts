export function getProtocolString(protocols: string | ('http' | 'https')[]) {
  if (!protocols || protocols.length < 1) {
    return 'http';
  }

  if (!Array.isArray(protocols)) {
    return protocols;
  }

  const tempProtocol = protocols.join('&').toLowerCase();
  return (tempProtocol === 'https&http' ? 'http&https' : tempProtocol) ?? 'http&https';
}

export function getUrlProtocol(p: string) {
  return p.indexOf('https') !== -1 ? 'https' : 'http';
}
