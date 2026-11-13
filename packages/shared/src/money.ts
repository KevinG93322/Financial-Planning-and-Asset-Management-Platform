export function formatUsd(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const withCommas = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${withCommas}.${remainder.toString().padStart(2, "0")}`;
}

export function formatPercentFromBps(bps: number): string {
  const negative = bps < 0;
  const tenths = Math.round(Math.abs(bps) / 10);
  const whole = Math.floor(tenths / 10);
  const fraction = tenths % 10;
  return `${negative ? "-" : ""}${whole}.${fraction}%`;
}

export function dollarsToCents(input: string): number {
  const trimmed = input.trim().replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Use a dollar amount with up to two decimals");
  }
  const negative = trimmed.startsWith("-");
  const unsigned = trimmed.replace("-", "");
  const [whole, fraction = ""] = unsigned.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) {
    throw new Error("Amount is too large");
  }
  return negative ? -cents : cents;
}

export function centsToDollarInput(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  return `${negative ? "-" : ""}${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, "0")}`;
}
