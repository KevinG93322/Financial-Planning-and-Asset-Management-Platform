import { keccak256, toUtf8Bytes } from "ethers";

function normalize(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Non-finite number in canonical JSON");
    }
    return value;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue;
      sorted[key] = normalize(source[key]);
    }
    return sorted;
  }
  throw new Error("Unsupported value in canonical JSON");
}

/** Stable JSON: sorted object keys, no insignificant whitespace. Array order is preserved. */
export function canonicalize(value: unknown): string {
  return JSON.stringify(normalize(value));
}

/** keccak256 of the canonical JSON, matching the bytes32 stored on chain. */
export function contentHash(value: unknown): string {
  return keccak256(toUtf8Bytes(canonicalize(value)));
}
