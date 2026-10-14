/** Join-page compatibility must not confuse a user's label with its document ID. */
import assert from "node:assert/strict";
import test from "node:test";
import { selectGamemaster } from "../e2e/foundry-session.mjs";

/** Minimal locator boundary: exercise the selection contract without a browser. */
function joinPage({ selector = null, role = "combobox", label = "Select User", tagName = "SELECT",
  options = [{ label: "Choose a user", value: "" }, { label: "Gamemaster", value: "gm-document-id" }],
  selectionWorks = true, initiallyVisible = true } = {}) {
  const calls = [];
  let visible = initiallyVisible, show;
  const displayed = new Promise(resolve => { show = () => { visible = true; resolve(); }; });
  let selected = options[0], input = "";
  const control = {
    evaluate: async callback => callback({ tagName }),
    locator(query) {
      return { allTextContents: async () => query === "option:checked" ? [selected.label] : options.map(option => option.label) };
    },
    selectOption: async ({ label: chosen }) => {
      calls.push(["selectOption", chosen]);
      if (selectionWorks) selected = options.find(option => option.label === chosen);
    },
    inputValue: async () => tagName === "SELECT" ? selected.value : input,
    click: async () => calls.push(["click"]),
    fill: async value => { input = value; calls.push(["fill", value]); },
    press: async key => calls.push(["press", key])
  };
  function locator(matches) {
    return { ...control, matches,
      count: async () => Number(visible && matches()), first() { return this; },
      or: other => locator(() => matches() || other.matches()),
      waitFor: async () => {
        if (!visible) await displayed;
        if (!matches()) throw new Error("The requested username control is absent.");
      }
    };
  }
  const page = {
    locator: query => locator(() => query === selector),
    getByRole: (requested, { name }) => locator(() => requested === role && name.test(label))
  };
  return { page, calls, show, selected: () => selected };
}

test("Given a new English or French accessible join combobox, when Gamemaster is selected, then an ID-valued option is accepted by its visible profile label", async () => {
  for (const label of ["Select User", "Sélectionner un utilisateur"]) {
    const fixture = joinPage({ label });
    assert.equal(await (await selectGamemaster(fixture.page)).inputValue(), "gm-document-id");
    assert.equal(fixture.selected().label, "Gamemaster");
    assert.equal(fixture.selected().value, "gm-document-id");
  }
});

test("Given a legacy native username select, when Gamemaster is selected, then both username-valued and ID-valued options remain supported", async () => {
  for (const value of ["gamemaster", "gm-document-id"]) {
    const fixture = joinPage({ selector: 'select[name="username"]',
      options: [{ label: "Choose a user", value: "" }, { label: "Gamemaster", value }] });
    assert.equal(await (await selectGamemaster(fixture.page)).inputValue(), value);
    assert.deepEqual(fixture.calls, [["selectOption", "Gamemaster"]]);
  }
});

test("Given a legacy search textbox, when Gamemaster is selected, then username input and keyboard confirmation remain supported", async () => {
  for (const selector of ["#join-username", 'input[name="username"]', null]) {
    const fixture = joinPage({ selector, role: "textbox", label: "Select a user", tagName: "INPUT" });
    assert.equal(await (await selectGamemaster(fixture.page)).inputValue(), "gamemaster");
    assert.deepEqual(fixture.calls, [["click"], ["fill", "gamemaster"], ["press", "ArrowDown"], ["press", "Enter"]]);
  }
});

test("Given a join form rendered after login preparation begins, when the accessible user combobox becomes visible, then selection waits for that control", async () => {
  const fixture = joinPage({ initiallyVisible: false });
  const selected = selectGamemaster(fixture.page);
  fixture.show();
  assert.equal(await (await selected).inputValue(), "gm-document-id");
  assert.equal(fixture.selected().label, "Gamemaster");
});

test("Given a native control that leaves another user selected, when its stored value happens to equal gamemaster, then the wrong visible profile is rejected", async () => {
  const fixture = joinPage({ selector: 'select[name="username"]', selectionWorks: false,
    options: [{ label: "Player", value: "gamemaster" }, { label: "Gamemaster", value: "gm-document-id" }] });
  await assert.rejects(selectGamemaster(fixture.page), /did not select.*gamemaster.*actual: Player/i);
});

test("Given a native select without the seeded Gamemaster profile, when login is prepared, then available users are reported before submission", async () => {
  const fixture = joinPage({ selector: 'select[name="username"]', options: [{ label: "Player", value: "player-id" }] });
  await assert.rejects(selectGamemaster(fixture.page), /Available users: Player.*Gamemaster profile was not found/i);
  assert.deepEqual(fixture.calls, []);
});
