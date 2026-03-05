import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDecimalValue,
  buildFractionDigitOptions,
  buildIntegerRangeOptions,
  splitDecimalValue
} from "../src/lib/decimal-picker";

test("splitDecimalValue parses normal decimal string", () => {
  const parsed = splitDecimalValue("72.4", 65);
  assert.equal(parsed.integerPart, "72");
  assert.equal(parsed.fractionPart, "4");
});

test("splitDecimalValue falls back to default integer when value is empty", () => {
  const parsed = splitDecimalValue("", 65);
  assert.equal(parsed.integerPart, "65");
  assert.equal(parsed.fractionPart, "0");
});

test("buildDecimalValue composes integer/fraction to one-decimal string", () => {
  assert.equal(buildDecimalValue("70", "3"), "70.3");
});

test("buildIntegerRangeOptions creates bounded range options", () => {
  const options = buildIntegerRangeOptions(65, 67);
  assert.deepEqual(
    options.map((item) => item.value),
    ["65", "66", "67"]
  );
});

test("buildFractionDigitOptions always returns 0-9", () => {
  const options = buildFractionDigitOptions();
  assert.equal(options.length, 10);
  assert.equal(options[0]?.value, "0");
  assert.equal(options[9]?.value, "9");
});
