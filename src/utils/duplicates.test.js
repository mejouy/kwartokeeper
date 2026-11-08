import { describe, expect, it, vi } from "vitest";

vi.mock("../config/firebase", () => ({ db: {}, auth: {} }));

const { phoneKey } = await import("./duplicates");

describe("phone numbers count as the same however they're typed", () => {
  it.each(["09171234567", "0917-123-4567", "0917 123 4567", "+63 917 123 4567", "639171234567", "9171234567"])("%s", (typed) => {
    expect(phoneKey(typed)).toBe("09171234567");
  });
  it("ignores numbers too short to compare", () => {
    expect(phoneKey("123")).toBe("");
    expect(phoneKey("")).toBe("");
  });
});
