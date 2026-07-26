# Deep Next.js Code Review Workflow

Use the workspace rule: @../rules/principal-nextjs-code-reviewer.md

Task: Perform a deep principal-level Next.js code review, then propose focused fixes.

Steps:

1. Inspect `package.json`, lockfile, Next.js version, app/router structure, TypeScript config, Tailwind config, tests, lint scripts, and existing conventions.
2. Identify review target: current diff, PR, commit range, route, component, failing test, or full repo.
3. Search code for server/client boundaries, data fetching, server actions, route handlers, auth, cache invalidation, forms, shared components, and heavy imports.
4. Verify current official docs before making version-sensitive claims about Next.js, React, Tailwind, TypeScript, or deployment behavior.
5. Review architecture before details.
6. Lead with findings ordered by P0, P1, P2, P3.
7. For each finding include file/line, risk, why it matters, and smallest credible fix.
8. Apply YAGNI. Do not invent abstractions unless they remove real duplication or coupling.
9. If asked to fix, implement only approved or highest-risk findings.
10. Validate with targeted lint/typecheck/test/build commands from the repo.
11. Final response must include changed files, validation run, and remaining risk.
