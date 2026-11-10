// Uses Web Crypto in both the browser and Node. No credentials are persisted here.
export function generatePortalPassword(): string {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%'];
  const pick = (length: number) => {
    const limit = 256 - (256 % length);
    const byte = new Uint8Array(1);
    do { globalThis.crypto.getRandomValues(byte); } while (byte[0] >= limit);
    return byte[0] % length;
  };
  const alphabet = groups.join('');
  const chars = groups.map(group => group[pick(group.length)]);
  while (chars.length < 20) chars.push(alphabet[pick(alphabet.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
