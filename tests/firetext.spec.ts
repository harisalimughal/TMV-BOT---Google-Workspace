import { describe, expect, it } from "vitest";
import { normalizeUkMobile } from "../src/integrations/firetext";

describe("normalizeUkMobile", () => {
  it("replaces a UK leading zero with the country code", () => {
    expect(normalizeUkMobile("07123456789")).toBe("447123456789");
  });

  it("strips spaces and dashes typed at booking time", () => {
    expect(normalizeUkMobile("07123 456 789")).toBe("447123456789");
    expect(normalizeUkMobile("07123-456-789")).toBe("447123456789");
  });

  it("leaves an already-international number untouched (minus a leading +)", () => {
    expect(normalizeUkMobile("+447123456789")).toBe("447123456789");
    expect(normalizeUkMobile("447123456789")).toBe("447123456789");
  });

  it("does not invent a country code for a number with neither a leading 0 nor 44", () => {
    // Not a UK number this app can guess at -- passed through digits-only, so Firetext's
    // own validation rejects it clearly rather than silently mis-dialing a UK number.
    expect(normalizeUkMobile("15551234567")).toBe("15551234567");
  });
});
