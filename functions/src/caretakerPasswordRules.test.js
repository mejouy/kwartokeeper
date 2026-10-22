const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { canResetCaretakerPassword, newTempPassword } = require("./caretakerPasswordRules.js");

const owner = { role: "owner", status: "active" };
const caretaker = { role: "caretaker", ownerUid: "owner1", invitedBy: "owner1" };

test("the owner who invited the caretaker may reset it", () => {
  assert.equal(canResetCaretakerPassword({ callerUid: "owner1", caller: owner, caretaker }).ok, true);
});

test("ownership via invitedBy alone is enough (older records)", () => {
  assert.equal(canResetCaretakerPassword({ callerUid: "owner1", caller: owner, caretaker: { role: "caretaker", invitedBy: "owner1" } }).ok, true);
});

test("another owner may not", () => {
  assert.equal(canResetCaretakerPassword({ callerUid: "owner2", caller: owner, caretaker }).ok, false);
});

test("a suspended owner may not", () => {
  assert.equal(canResetCaretakerPassword({ callerUid: "owner1", caller: { role: "owner", status: "suspended" }, caretaker }).ok, false);
});

test("tenants and caretakers may not", () => {
  assert.equal(canResetCaretakerPassword({ callerUid: "owner1", caller: { role: "tenant" }, caretaker }).ok, false);
  assert.equal(canResetCaretakerPassword({ callerUid: "owner1", caller: { role: "caretaker" }, caretaker }).ok, false);
});

test("only caretaker accounts can be reset", () => {
  assert.equal(canResetCaretakerPassword({ callerUid: "owner1", caller: owner, caretaker: { role: "tenant", ownerUid: "owner1" } }).ok, false);
  assert.equal(canResetCaretakerPassword({ callerUid: "owner1", caller: owner, caretaker: null }).ok, false);
});

test("an admin may reset any caretaker", () => {
  assert.equal(canResetCaretakerPassword({ callerUid: "admin1", caller: { role: "admin" }, caretaker }).ok, true);
});

test("new passwords use the Kwarto-##### format", () => {
  for (let i = 0; i < 50; i += 1) assert.match(newTempPassword(crypto.randomInt), /^Kwarto-\d{5}$/);
});
