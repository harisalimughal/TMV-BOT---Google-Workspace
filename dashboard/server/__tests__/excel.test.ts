import { describe, expect, it } from "vitest";
import { loadExcelDataset } from "../read/excel-loader";

describe("Excel Local Dataset Fallback", () => {
  it("loads the workbook dataset", () => {
    const dataset = loadExcelDataset();
    expect(dataset).not.toBeNull();
    if (dataset) {
      expect(dataset.bookings.length).toBeGreaterThan(0);
      expect(dataset.drivers.length).toBeGreaterThan(0);
    }
  });
});
