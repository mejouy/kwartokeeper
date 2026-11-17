import { describe, expect, it, vi } from "vitest";

vi.mock("../config/firebase", () => ({ db: {}, auth: {} }));

const { assignmentConflicts, assignmentFields, propertyIdsOf, takenProperties, validateAssignment } = await import("./caretakerAssignment");

const ana = { id: "C1", name: "Ana", assignedPropertyId: "P1" };
const ben = { id: "C2", name: "Ben", assignedPropertyId: "P2", assignedPropertyIds: ["P2", "P3"] };
const gone = { id: "C3", name: "Old", assignedPropertyId: "P4", status: "Inactive" };

describe("caretaker assignment rule", () => {
  it("reads every property of a caretaker, old records included", () => {
    expect(propertyIdsOf(ana)).toEqual(["P1"]);
    expect(propertyIdsOf(ben)).toEqual(["P2", "P3"]);
    expect([...takenProperties([ana, ben, gone]).keys()]).toEqual(["P1", "P2", "P3"]);
  });

  it("one to one: one property each, no sharing", () => {
    const base = { mode: "one_to_one", caretakers: [ana, ben] };
    expect(validateAssignment({ ...base, propertyIds: ["P4"] })).toBe("");
    expect(validateAssignment({ ...base, propertyIds: ["P4", "P5"] })).toMatch(/one property per caretaker/);
    expect(validateAssignment({ ...base, propertyIds: ["P1"] })).toMatch(/already has a caretaker \(Ana\)/);
    expect(validateAssignment({ ...base, propertyIds: ["P1"], caretakerId: "C1" })).toBe("");
    expect(validateAssignment({ ...base, propertyIds: [] })).not.toBe("");
  });

  it("the other rules allow several properties and/or sharing", () => {
    expect(validateAssignment({ mode: "one_to_many", caretakers: [ana], propertyIds: ["P4", "P5"] })).toBe("");
    expect(validateAssignment({ mode: "one_to_many", caretakers: [ana], propertyIds: ["P1", "P5"] })).not.toBe("");
    expect(validateAssignment({ mode: "many_to_one", caretakers: [ana], propertyIds: ["P1"] })).toBe("");
    expect(validateAssignment({ mode: "many_to_one", caretakers: [ana], propertyIds: ["P1", "P2"] })).not.toBe("");
    expect(validateAssignment({ mode: "many_to_many", caretakers: [ana, ben], propertyIds: ["P1", "P2"] })).toBe("");
  });

  it("keeps the property a caretaker is working on when it is still theirs", () => {
    expect(assignmentFields(["P2", "P3"], { current: "P3", names: { P2: "Two", P3: "Three" } })).toEqual({
      assignedPropertyIds: ["P2", "P3"],
      assignedPropertyNames: { P2: "Two", P3: "Three" },
      assignedPropertyId: "P3",
    });
    expect(assignmentFields(["P2"], { current: "P9" }).assignedPropertyId).toBe("P2");
  });

  it("lists caretakers a stricter rule would not allow", () => {
    expect(assignmentConflicts("one_to_one", [ana, ben]).map((c) => c.caretaker.id)).toEqual(["C2"]);
    expect(assignmentConflicts("many_to_many", [ana, ben])).toEqual([]);
    expect(assignmentConflicts("one_to_many", [ana, { id: "C9", assignedPropertyId: "P1" }]).map((c) => c.caretaker.id)).toEqual(["C9"]);
  });
});
