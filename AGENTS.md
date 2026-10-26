# RepairTrace contributor notes

## RepairTrace — Repository Instructions

### Product source of truth

- Read docs/PRD.md before implementing a feature.
- Implement only the current requested milestone; do not build future features early.
- The current first milestone is backend registration only. No React/frontend until explicitly requested.
- Keep the scope suitable for the 27 October 2026 end-term deadline.
### Engineering rules

- Use a consistent MVC-style Express structure.
- Use small, readable modules and avoid unnecessary abstractions/dependencies.
- Validate every request at the backend boundary.
- Never trust client-supplied role, owner ID, repair reference, quote total, approval actor, or status if it can be generated/verified server-side.
- Never store plaintext passwords or return password hashes.
- Public registration creates customers only; never allow role escalation.
- Keep secrets in ignored environment files; commit .env.example with placeholders only.
- Do not log passwords, tokens, database credentials, or sensitive customer information.
- Update README.md when setup, API behavior, environment variables, or commands change.
- Explain important implementation decisions in plain language so the student can defend the code in a viva.
### Required workflow for every implementation request

1. Inspect git status, the current structure, and related files before editing. Preserve unrelated changes; never reset or overwrite user work.
2. State a short implementation plan and list the likely files to change.
3. Implement only the requested task with the smallest sensible change.
4. Run relevant tests and checks. At minimum, run the project test command and syntax/lint/build checks that exist. Add tests for new critical validation or business rules.
5. Inspect git diff --check, git status --short, and the full diff. Confirm no secrets, .env files, generated junk, or unrelated changes are staged.
6. If checks pass and the task is complete, create a descriptive commit and push it to the configured origin branch without asking me to do the commit manually. Use a meaningful message such as feat(auth): add customer registration validation.
7. Before committing, stage explicit intended files rather than blindly staging everything. Verify the staged diff.
8. After pushing, report the commit hash, branch, files changed, checks run, test results, and any remaining issues.
### Git safety conditions

- Commit/push automatically only when the requested implementation task is complete, relevant checks pass, and the staged diff has been inspected.
- Do not commit or push if tests fail, the task is incomplete, secrets are detected, the diff contains unrelated changes, or the repository/remote is not configured safely. Fix the issue or report the blocker instead.
- Never use git push --force, destructive reset/clean commands, or history rewriting unless I explicitly request and approve that specific action.
- Never bypass an approval prompt or attempt to work around sandbox/network restrictions. If Codex requires permission for Git write/network actions, ask for the specific required approval. Do not claim a push succeeded unless Git confirms it.
- If push fails because of authentication, branch protection, network, or remote divergence, keep the local commit, explain the precise failure, and provide the smallest safe recovery step. Do not force-push.
- If there are no code/document changes, do not create an empty commit.
### Completion report

At the end of every implementation task, summarize:
- What changed and why
- Files added/changed
- Commands and tests run, with actual results
- Commit hash and push status, if successful
- Known gaps and the next smallest milestone
