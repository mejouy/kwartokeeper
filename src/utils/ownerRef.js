// A short, readable reference number for an owner account, e.g. OWN-7K3Q9-X2M4T.
// It is worked out from the account's internal ID, so the same owner always gets
// the same number and nothing needs to be stored. The internal ID can't be read
// back from it. Used wherever an admin needs to point at an owner without
// showing the raw ID.

// Crockford base32: no I, L, O or U, so it is hard to misread over the phone.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function fnv1a(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function toBase32(n, len) {
  let out = "";
  let v = n >>> 0;
  for (let i = 0; i < len; i += 1) {
    out = ALPHABET[v & 31] + out;
    v = Math.floor(v / 32);
  }
  return out;
}

export function ownerRefCode(uid) {
  const id = String(uid || "");
  if (!id) return "";
  // Two independent 32-bit hashes give 10 characters (50 bits), plenty to avoid clashes.
  const a = fnv1a(id, 2166136261);
  const b = fnv1a(id, 0x9747b28c);
  const text = toBase32(a, 5) + toBase32(b, 5);
  return `OWN-${text.slice(0, 5)}-${text.slice(5)}`;
}

// Lets a search box match a typed code however it was written: "own7k3q9", "OWN-7K3Q9-X2M4T", "7k3q9 x2m4t".
export const normalizeRef = (s) => String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "");