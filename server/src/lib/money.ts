/** Integer minor units only. Never floats, never display strings. */
export const moneyMinorToDecimal = (minor: number, exponent = 2): number => minor / 10 ** exponent;

export const decimalToMoneyMinor = (value: number, exponent = 2): number =>
  Math.round(value * 10 ** exponent);

export const parseMoneyInput = (input: string, exponent = 2): number => {
  const cleaned = input.replace(/[^0-9.-]/g, "");
  if (!cleaned) throw new Error("Invalid money value");
  return Math.round(Number(cleaned) * 10 ** exponent);
};

export const sumMinor = (values: number[]): number => values.reduce((a, b) => a + b, 0);
