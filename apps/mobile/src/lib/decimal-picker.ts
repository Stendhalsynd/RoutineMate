export type PickerOption = {
  value: string;
  label: string;
};

const FRACTION_DIGITS = Array.from({ length: 10 }, (_, index) => String(index));

export function splitDecimalValue(rawValue: string, defaultInteger: number): {
  integerPart: string;
  fractionPart: string;
} {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return {
      integerPart: String(defaultInteger),
      fractionPart: "0"
    };
  }

  const [left, right] = trimmed.split(".");
  const integerPart = left && left.length > 0 ? left : String(defaultInteger);
  const fractionPart = right && right.length > 0 ? right.charAt(0) : "0";
  return {
    integerPart,
    fractionPart
  };
}

export function buildDecimalValue(integerPart: string, fractionPart: string): string {
  const integer = integerPart.trim();
  const fraction = fractionPart.trim();
  if (!integer.length) {
    return "";
  }
  return `${integer}.${fraction.length ? fraction.charAt(0) : "0"}`;
}

export function buildIntegerRangeOptions(min: number, max: number): PickerOption[] {
  const options: PickerOption[] = [];
  for (let value = min; value <= max; value += 1) {
    options.push({
      value: String(value),
      label: String(value)
    });
  }
  return options;
}

export function buildFractionDigitOptions(): PickerOption[] {
  return FRACTION_DIGITS.map((value) => ({
    value,
    label: `.${value}`
  }));
}
