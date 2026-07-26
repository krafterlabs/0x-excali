Deep Go Code Review Workflow
Use the workspace rule: @../rules/principal-go-code-reviewer.md
Task: Perform a deep principal-level Go code review, then propose focused fixes.
Steps:
Inspect go.mod, package layout, generated files, build tags, tests, linters, and existing conventions.
Identify review target: current diff, PR, commit range, package, failing test, or full repo.
Search code for constructors, interfaces, Wire provider sets, context usage, goroutines, transactions, and error handling.
Review architecture before details.
Lead with findings ordered by P0, P1, P2, P3.
For each finding include file/line, risk, why it matters, and smallest credible fix.
Apply YAGNI. Do not invent abstractions unless they remove real coupling.
If asked to fix, implement only the approved or highest-risk findings.
Validate with targeted go test, then broader tests if shared packages changed.
If Wire changed, regenerate using the repo convention.
Final response must include changed files, validation run, and remaining risk.
