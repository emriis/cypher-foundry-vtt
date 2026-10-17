/**
 * Lint each ESM execution environment with its own available globals.
 * Foundry's browser runtime, pure rules, Node scripts, and test mocks have
 * different boundaries; one shared global list would hide environment mistakes.
 */
import globals from "globals";
import { builtinModules, isBuiltin } from "node:module";

const nodeImports = [...new Set(builtinModules.flatMap(name => [name, `node:${name}`]))];

const foundryGlobals = Object.fromEntries([
  "foundry", "game", "ui", "canvas", "CONFIG", "CONST", "Hooks", "Actor",
  "Item", "ChatMessage", "Roll", "Dialog", "TextEditor", "Handlebars",
  "Actors", "Items", "fromUuid", "fromUuidSync", "renderTemplate", "loadTemplates"
].map(name => [name, "readonly"]));

export default [
  { ignores: ["node_modules/**", "dist/**", "packs/**", "docs/**", "test-results/**", "reports/**"] },
  {
    files: ["**/*.mjs"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: {
      "no-undef": "error", "no-unreachable": "error", "no-dupe-args": "error",
      "no-dupe-keys": "error", "no-constant-binary-expression": "error",
      "no-restricted-imports": ["error", { patterns: [
        { regex: "^\\.{1,2}/(?!.*\\.mjs$)",
          message: "Relative ESM imports must include their .mjs extension." }
      ] }]
    }
  },
  {
    files: ["tests/**/*.mjs"],
    languageOptions: { globals: Object.fromEntries(Object.keys(foundryGlobals).map(name => [name, "writable"])) }
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "*.config.mjs"],
    languageOptions: { globals: globals.node }
  },
  {
    files: ["cypher.mjs", "module/**/*.mjs"],
    plugins: { runtime: { rules: {
      "no-node-dynamic-import": {
        create(context) {
          return { ImportExpression(node) {
            if (typeof node.source.value === "string" && isBuiltin(node.source.value)) {
              context.report({ node, message: "Node APIs cannot run in Foundry browser modules." });
            }
          } };
        }
      }
    } } },
    languageOptions: { globals: { ...globals.browser, ...foundryGlobals } },
    rules: { "no-restricted-imports": ["error", {
      paths: nodeImports.map(name => ({ name, message: "Node APIs cannot run in Foundry browser modules." })),
      patterns: [
      { group: ["node:*"], message: "Node APIs cannot run in Foundry browser modules." },
      { regex: "^\\.{1,2}/(?!.*\\.mjs$)",
        message: "Relative ESM imports must include their .mjs extension." }
    ] }],
    "runtime/no-node-dynamic-import": "error" }
  },
  {
    files: ["module/rules/**/*.mjs", "module/crd/**/*.mjs", "module/config.mjs"],
    languageOptions: { globals: Object.fromEntries(Object.keys({ ...globals.browser, ...foundryGlobals })
      .map(name => [name, "off"])) }
  },
  {
    // Browser callbacks intentionally execute in Foundry, not in Node.
    files: ["tests/e2e/**/*.mjs"],
    languageOptions: { globals: { ...globals.browser, ...foundryGlobals } }
  }
];
