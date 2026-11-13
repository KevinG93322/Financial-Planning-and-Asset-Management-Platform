import { DISCLAIMER, assertLocalDemo, buildLoginMessage, contentHash, formatPercentFromBps, formatUsd } from "@fp/shared";
import { describe, expect, it } from "vitest";

describe("shared helpers", () => {
  it("hashes objects independently of key order", () => {
    const left = contentHash({ b: 1, a: { d: true, c: "plan" } });
    const right = contentHash({ a: { c: "plan", d: true }, b: 1 });
    expect(left).toBe(right);
    expect(left).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("formats money and percentages", () => {
    expect(formatUsd(850_000)).toBe("$8,500.00");
    expect(formatUsd(-9_500_000)).toBe("-$95,000.00");
    expect(formatPercentFromBps(2706)).toBe("27.1%");
    expect(formatPercentFromBps(2000)).toBe("20.0%");
  });

  it("builds a stable sign-in message and guards the demo key", () => {
    const message = buildLoginMessage("0x70997970c51812dc3a010c7d01b50e0d17dc79c8", "abc", "2026-11-12T00:00:00.000Z");
    expect(message).toContain("Nonce: abc");
    expect(message).toContain("Address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    expect(() => assertLocalDemo(31337, "http://127.0.0.1:8545")).not.toThrow();
    expect(() => assertLocalDemo(31337, "http://localhost:8545")).not.toThrow();
    expect(() => assertLocalDemo(1, "http://127.0.0.1:8545")).toThrow(/31337/);
    expect(() => assertLocalDemo(31337, "https://rpc.example")).toThrow(/31337/);
  });

  it("keeps the educational disclaimer constant", () => {
    expect(DISCLAIMER).toMatch(/educational simulation/i);
  });
});
