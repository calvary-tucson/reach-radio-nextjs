// Canonical scopes live in AGENTS.md ("Canonical Commit Scopes"). Keep the two lists identical.
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "bridge", "seo", "teachers", "schedule", "theme", "modal", "player", "sleep-timer",
        "donate", "about", "layout", "api", "global", "ppr", "test",
      ],
    ],
    "scope-case": [2, "always", "kebab-case"],
    "subject-case": [0],
    "header-max-length": [2, "always", 100],
  },
};

export default config;
