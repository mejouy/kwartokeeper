import { describe, expect, it } from "vitest";
import fil from "./fil";
import { t } from "./index";

const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort();

describe("Filipino translations", () => {
  it.each(Object.entries(fil))("%s keeps its placeholders", (english, filipino) => {
    expect(placeholders(filipino)).toEqual(placeholders(english));
  });
  it("has no empty translations", () => {
    expect(Object.entries(fil).filter(([, v]) => !String(v).trim())).toEqual([]);
  });
});

describe("t()", () => {
  it("falls back to the English text and fills in placeholders", () => {
    expect(t("Due in {days}", { days: "3 days" })).toBe("Due in 3 days");
    expect(t("Text nobody translated")).toBe("Text nobody translated");
  });
});
