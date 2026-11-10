import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "drizzle/**", "_legacy/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      eqeqeq: ["error", "always"],
      "no-console": "warn",
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      // The API logs through pino; a stray console call is a real smell.
      "no-console": "error",
    },
  },
  {
    files: ["scripts/**/*.ts"],
    rules: {
      // CLI scripts talk to a human, not to the log pipeline.
      "no-console": "off",
    },
  },
  prettier,
);
