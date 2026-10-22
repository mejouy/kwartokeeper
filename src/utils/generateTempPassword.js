// src/utils/generateTempPassword.js
//
// Generates a temporary password in the "Kwarto-XXXXX" format shown in the
// Figma mockup. Used once: the caretaker must choose their own password on
// first sign-in (see pages/auth/SetPassword.jsx).
// Uses the browser's secure random generator rather than Math.random.

export function generateTempPassword() {
  const buf = new Uint32Array(1);
  (globalThis.crypto || window.crypto).getRandomValues(buf);
  const digits = 10000 + (buf[0] % 90000); // 5-digit number
  return `Kwarto-${digits}`;
}
