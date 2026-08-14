import { describe, expect, it } from "vitest";
import { withJobLock, withLock } from "../src/utils/lock";

/**
 * The double-tap bug: two clicks milliseconds apart both read `actualStart === ""`
 * because the Sheets write mutex orders writes, not read-then-write sequences.
 */
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("per-job lock", () => {
  it("serialises a read-modify-write against the same job", async () => {
    let shared = 0;
    const readModifyWrite = () =>
      withJobLock("TMV-1", async () => {
        const seen = shared;
        await sleep(10); // the window a double-tap exploits
        shared = seen + 1;
      });

    await Promise.all([readModifyWrite(), readModifyWrite(), readModifyWrite()]);
    expect(shared).toBe(3); // 1 without the lock
  });

  it("lets only the first of two concurrent starts through the guard", async () => {
    const job = { actualStart: "" };
    let starts = 0;
    let emails = 0;

    const start = () =>
      withJobLock("TMV-2", async () => {
        await sleep(5);
        if (job.actualStart) return "already-started";
        job.actualStart = new Date().toISOString();
        starts++;
        emails++;
        return "started";
      });

    const results = await Promise.all([start(), start(), start()]);
    expect(starts).toBe(1);
    expect(emails).toBe(1); // the customer must not get three emails
    expect(results.filter(r => r === "started")).toHaveLength(1);
  });

  it("does not block a different job", async () => {
    const order: string[] = [];
    await Promise.all([
      withJobLock("A", async () => {
        await sleep(30);
        order.push("A");
      }),
      withJobLock("B", async () => {
        await sleep(1);
        order.push("B");
      })
    ]);
    // B must not queue behind A's slow work.
    expect(order).toEqual(["B", "A"]);
  });

  it("releases the lock when the body throws", async () => {
    await expect(withJobLock("C", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(withJobLock("C", async () => "recovered")).resolves.toBe("recovered");
  });

  it("preserves FIFO order for the same key", async () => {
    const order: number[] = [];
    await Promise.all(
      [1, 2, 3, 4].map(n =>
        withLock("fifo", async () => {
          await sleep(5);
          order.push(n);
        })
      )
    );
    expect(order).toEqual([1, 2, 3, 4]);
  });
});
