import { describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock("@capacitor/filesystem", () => ({ Directory: {}, Filesystem: {} }));
vi.mock("@capacitor/share", () => ({ Share: {} }));

const { agreementStatus, contractOf, contractValues, fillContract, houseRulesOf } = await import("./contract");

const property = { id: "P1", propertyName: "Casa", contract: { enabled: true, title: "Agreement", body: "Hi {tenantName}, rent is {monthlyRent} due every {dueDay}. {unknown}", version: 2 }, rules: ["No smoking", " "] };
const tenant = { name: "Ana", monthlyRent: 3500, rentDueDay: 3, propertyId: "P1" };

describe("rental contract", () => {
  it("is only there when the owner turned it on and wrote it", () => {
    expect(contractOf(property).version).toBe(2);
    expect(contractOf({ contract: { enabled: false, body: "x" } })).toBeNull();
    expect(contractOf({ contract: { enabled: true, body: "  " } })).toBeNull();
  });

  it("fills in the tenant's details and keeps unknown placeholders", () => {
    const text = fillContract(property.contract.body, contractValues({ tenant, property }));
    expect(text).toBe("Hi Ana, rent is ₱3,500 due every 3rd. {unknown}");
  });

  it("asks again after the owner changes it", () => {
    expect(agreementStatus(property, tenant)).toBe("pending");
    expect(agreementStatus(property, { ...tenant, contractAgreement: { propertyId: "P1", version: 2 } })).toBe("agreed");
    expect(agreementStatus(property, { ...tenant, contractAgreement: { propertyId: "P1", version: 1 } })).toBe("outdated");
    expect(agreementStatus(property, { ...tenant, contractAgreement: { propertyId: "P9", version: 2 } })).toBe("pending");
    expect(agreementStatus({ id: "P1" }, tenant)).toBe("none");
  });

  it("lists the typed house rules", () => {
    expect(houseRulesOf(property)).toEqual(["No smoking"]);
    expect(houseRulesOf({ rulesText: "A\n\nB" })).toEqual(["A", "B"]);
  });
});
