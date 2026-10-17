import assert from "node:assert/strict";
import vm from "node:vm";
import test from "node:test";
import { setDiceUniform, restoreDiceUniform, assertNoUnexpectedPageErrors } from "../e2e/browser-contracts.mjs";

test("dice overrides restore their original function across repeated calls and page reload", async () => {
  let context;
  const original = () => 0.7;
  const reload = () => { context = vm.createContext({ CONFIG: { Dice: { randomUniform: original } } }); };
  const page = { evaluate: async (callback, value) => {
    context.argument = value;
    return vm.runInContext(`(${callback.toString()})(argument)`, context);
  } };
  reload();
  await setDiceUniform(page, 0.1);
  await setDiceUniform(page, 0.2);
  assert.equal(context.CONFIG.Dice.randomUniform(), 0.2);
  await restoreDiceUniform(page);
  assert.equal(context.CONFIG.Dice.randomUniform, original);
  await setDiceUniform(page, 0.3);
  reload();
  await restoreDiceUniform(page);
  assert.equal(context.CONFIG.Dice.randomUniform, original);
  await assert.rejects(setDiceUniform(page, 1), RangeError);
});

test("a browser exception fails an otherwise green scenario without replacing an existing failure", () => {
  assert.throws(() => assertNoUnexpectedPageErrors(["injected runtime exception"]), /injected runtime exception/);
  assert.doesNotThrow(() => assertNoUnexpectedPageErrors([]));
  assert.doesNotThrow(() => assertNoUnexpectedPageErrors(["secondary exception"], true));
});
