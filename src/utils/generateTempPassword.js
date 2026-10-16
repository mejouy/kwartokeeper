// src/utils/generateTempPassword.js
//
// Generates a temporary password in the "Kwarto-XXXXX" format shown in the
// Figma mockup. Random enough for a one-time invite credential; the
// caretaker is expected to change it on first login (not yet built,
// flag this to the team when they wire up caretaker Login).

export function generateTempPassword() {
  const digits = Math.floor(10000 + Math.random() * 90000); // 5-digit number
  return `Kwarto-${digits}`;
}
