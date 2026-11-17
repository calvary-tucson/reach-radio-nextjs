import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // AGENTS.md a11y rules, machine-enforced. The plugin itself is already registered by
  // eslint-config-next, so only the rules are added (redeclaring the plugin throws).
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { ...jsxA11y.flatConfigs.recommended.rules },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Exclude git worktrees (isolated development branches):
    ".worktrees/**",
    // Other checkouts and build output live under the main checkout; never lint them:
    ".claude/worktrees/**",
    "**/.next/**",
    ".cutover-backup/**",
    ".superpowers/**",
    ".playwright-mcp/**",
    // Exclude third-party minified scripts:
    "public/**",
  ]),
]);

export default eslintConfig;
