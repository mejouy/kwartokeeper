// Pure rules for resetting a caretaker's password (kept separate so they can be tested).

const lower = (v) => String(v || "").trim().toLowerCase();

/**
 * Who may give a caretaker a new temporary password: an admin, or the owner who
 * invited / owns that caretaker, as long as the owner's account isn't suspended.
 */
function canResetCaretakerPassword({ callerUid, caller, caretaker }) {
  if (!caller) return { ok: false, reason: "Your account couldn't be found." };
  if (!caretaker || lower(caretaker.role) !== "caretaker") return { ok: false, reason: "That account isn't a caretaker." };

  const role = lower(caller.role);
  if (role === "admin") return { ok: true };
  if (role !== "owner") return { ok: false, reason: "Only the property owner can do this." };
  if (lower(caller.status) === "suspended") return { ok: false, reason: "Your account is suspended." };

  const mine = caretaker.ownerUid === callerUid || caretaker.invitedBy === callerUid;
  if (!mine) return { ok: false, reason: "This caretaker isn't on your account." };
  return { ok: true };
}

// Same "Kwarto-12345" format as the invite, from a secure random source
function newTempPassword(randomInt) {
  return `Kwarto-${randomInt(10000, 100000)}`;
}

module.exports = { canResetCaretakerPassword, newTempPassword };
