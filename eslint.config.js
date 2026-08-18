import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Q-4: a real static-analysis gate (the old `lint` script just re-ran tsc).
 * Deliberately narrow: correctness rules error, style-ish rules warn, so the
 * gate is useful on day one instead of drowning the repo in noise.
 */
export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "data/**", "docs/**", "**/*.d.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["client/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["server/**/*.ts", "scripts/**/*.ts", "scripts/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ["client/public/**/*.js"],
    languageOptions: {
      globals: { ...globals.serviceworker, ...globals.browser },
    },
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    rules: {
      // Upstream JSON and the D1/Workers surface are genuinely untyped in places.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      eqeqeq: ["warn", "smart"],
      "no-console": "off",
      // Defensive `let x = ""` before a branch that always assigns is deliberate
      // in the playback paths; not worth rewriting hot code to satisfy.
      "no-useless-assignment": "warn",
    },
  }
);
