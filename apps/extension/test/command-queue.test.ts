import { describe, expect, it } from "vitest";
import { createCommandQueue } from "../utils/command-queue";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("capture command queue", () => {
  it("finishes one tab's start before another tab can replace its capture", async () => {
    const enqueue = createCommandQueue();
    const firstBadge = deferred();
    const steps: string[] = [];

    const first = enqueue(async () => {
      steps.push("capture A");
      await firstBadge.promise;
      steps.push("badge A");
    });
    const second = enqueue(async () => {
      steps.push("stop A");
      steps.push("capture B");
      steps.push("badge B");
    });

    await Promise.resolve();
    expect(steps).toEqual(["capture A"]);
    firstBadge.resolve();
    await Promise.all([first, second]);
    expect(steps).toEqual(["capture A", "badge A", "stop A", "capture B", "badge B"]);
  });

  it("runs the next command after a failed command", async () => {
    const enqueue = createCommandQueue();
    await expect(enqueue(async () => { throw new Error("capture failed"); })).rejects.toThrow("capture failed");
    await expect(enqueue(async () => "ready")).resolves.toBe("ready");
  });
});
