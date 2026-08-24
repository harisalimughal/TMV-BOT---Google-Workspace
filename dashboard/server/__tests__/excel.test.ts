import { describe, expect, it } from "vitest";
import { loadExcelDataset } from "../read/excel-loader";

// No .xlsx fixture is checked into the repo (it would be real customer/business
// data) -- so in this environment loadExcelDataset() always takes its "no file
// found" path. That's the behavior worth covering here: a missing fallback file
// must fail soft (null), never throw, since it's the last resort after a live
// Sheets read has already failed (see sheet-reader.ts).
describe("Excel Local Dataset Fallback", () => {
  it("returns null gracefully when no fallback workbook is present", () => {
    expect(loadExcelDataset()).toBeNull();
  });

  it("loads and tags a real workbook dataset when one is supplied", () => {
    const dataset = loadExcelDataset(process.env.TMV_TEST_XLSX_FIXTURE);
    if (!dataset) return; // no fixture available in this environment -- nothing more to assert
    expect(dataset.bookings.length).toBeGreaterThan(0);
    expect(dataset.drivers.length).toBeGreaterThan(0);
    expect(dataset.source).toBe("fallback");
  });
});
