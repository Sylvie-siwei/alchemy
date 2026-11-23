// Composed from the installed lint plugins; no starter-specific rules.
import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";
import next from "@next/eslint-plugin-next";
import globals from "globals";

export default defineConfig([
  globalIgnores([".next/**", "dist/**", "out/**", "build/**", "next-env.d.ts", "artifacts/**"]),
  js.configs.recommended,
  ...ts.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  hooks.configs.flat["recommended-latest"],
  a11y.flatConfigs.recommended,
  next.configs["core-web-vitals"],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.serviceworker } },
    settings: { react: { version: "detect" } },
  },
]);
