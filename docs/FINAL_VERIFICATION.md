# RepairTrace final verification

Verification date: 2026-10-27

This checklist records source inspection and automated checks run in the local repository. It does not certify a deployed environment or a real-browser session. Backend automated tests use `mongodb-memory-server`; they do not use the application's ignored `backend/.env` configuration.

## Authentication and authorization

| Requirement | Status | Evidence and remaining action |
|---|---|---|
| Registration validation, normalization, duplicate prevention, customer-only role, password hashing, and safe response | PASS | Backend auth tests cover registration validation, duplicate email and role rejection; `authController.register` normalizes through `validateRegistration`, hashes before persistence, and serializes safe fields. |
| Login validation, safe credential errors, signed session cookie, and current-user lookup | PASS | Backend auth tests cover login and `/me`; `authController` sets an HttpOnly seven-day cookie, SameSite=Lax, Secure in production, and does not return a JWT. `requireAuth` verifies HS256 and reloads the user from MongoDB. |
| Logout and stale/invalid cookie behavior | PASS | Backend auth tests verify logout cookie clearing and rejected invalid/stale sessions. Logout clears the browser cookie; the stateless JWT itself remains valid until expiry if separately copied. |
| Staff provisioning does not overwrite credentials by default | PASS | Provisioning tests cover create/refusal/promotion modes; CLI requires explicit `STAFF_PROVISION_MODE=promote` to promote an existing customer and does not reset that account's password. |
| Role boundaries and server-side ownership | PASS | Route middleware enforces staff/customer actions; workflow tests prove non-owners receive 404 and owners can decide current quotations. Authentication identity comes from the database-loaded `req.user`, not request fields. |
| Frontend route/session guard behavior | PASS | `frontend/tests/routing.test.js` passes its three routing helper cases. Source inspection confirms `/me` session restoration and role-gated route components. Browser refresh/back-forward behavior was not manually exercised (see Frontend and routing). |

## Repair intake and customer ownership

| Requirement | Status | Evidence and remaining action |
|---|---|---|
| Staff can create a repair by customer email; unknown, malformed, and staff emails are rejected | PASS | Repair intake tests cover normalized email lookup and invalid/non-customer cases. `createRepair` resolves the email to a `customer` User server-side. |
| Device and repair references use the selected customer's ObjectId; creator comes from authenticated staff | PASS | Intake tests inspect saved references; `createRepair` writes `customer._id` to both documents and `req.user._id` to `createdBy`. Conflicting email/customerId values are rejected. |
| Repair numbers remain sequential and unique under concurrent intake | PASS | Repair intake tests exercise concurrent creation; the atomic `RepairCounter` update and unique `repairNumber` index enforce allocation. |
| Customers list only their repairs and cannot inspect another customer's repair | PASS | Workflow tests prove owner list/detail access and another customer's 404. List/detail queries filter by the authenticated `req.user._id`; no repairs array was added to User. |
| Frontend uses email lookup and displays actual API data | PASS | `CreateRepair` sends `customerEmail`; frontend calls the API client, which uses credentialed requests. Build and source inspection confirm persisted API usage, not mock data. |

## Diagnosis and quotations

| Requirement | Status | Evidence and remaining action |
|---|---|---|
| Diagnosis required before quotation; staff-only diagnosis and quote creation | PASS | Backend workflow tests cover role denial and diagnosis prerequisite. Routes require staff authorization. |
| Server validates quote lines and calculates paise totals; versions are concurrent-safe | PASS | Workflow tests cover validation, server totals, increasing versions, and concurrent quote creation. Model stores integer paise; saves use optimistic concurrency retry. |
| Owning customer can read and decide only the latest pending quote; other customers and staff are denied | PASS | Workflow tests cover quote history, 404 for another customer, 403 for staff decision, and stale version rejection. |
| Diagnosis edit does not leave a stale approval; unchanged diagnosis preserves a pending approval | PASS | Added regression test `re-saving an unchanged diagnosis preserves the current quotation approval state`. A genuinely changed diagnosis supersedes existing quotes; unchanged text no longer changes `awaiting_approval` to `diagnosing`. |
| Quote history/customer response contains no internal diagnosis notes | PASS | Serializer includes `diagnosisNotes` only for staff; source inspection confirms customer history filters non-customer-safe events. |
| Quote revision and stale decision messaging in the browser | NOT TESTED | Backend behavior is covered by tests; no interactive browser session was run to verify rendered error wording. |

## Lifecycle and parts blockers

| Requirement | Status | Evidence and remaining action |
|---|---|---|
| Arbitrary lifecycle skips and work without current quote approval are rejected | PASS | Workflow tests cover invalid transitions and approved-quote requirement; `changeRepairStatus` validates allowed source states. |
| Parts blocker needs a reason and is cleared only through explicit resolution | PASS | Workflow tests cover missing reason, blocker addition/resolution, and history events. |
| Quote revisions invalidate prior approval | PASS | Workflow tests cover superseding a prior quote and requiring a fresh customer decision. |

## Quality checks and handover

| Requirement | Status | Evidence and remaining action |
|---|---|---|
| Fresh quality attempts use server-defined checks; readiness requires all checks to pass | PASS | Workflow tests cover pending checks, failed checks, rework, fresh attempts, and readiness gating. |
| Completed/unknown checks cannot be altered; failures require notes | PASS | Workflow tests cover validation and immutable completed results; controller checks before mutating. |
| Handover requires ready state and records authenticated staff/time atomically | PASS | Workflow tests cover premature and successful handover; optimistic concurrency and status validation prevent repeat/invalid handover. |
| Customer sees no staff-only quality/handover fields | PASS | Serializer includes quality attempts and detailed handover only for staff. |

## Frontend and routing

| Requirement | Status | Evidence and remaining action |
|---|---|---|
| Frontend unit tests | PASS | `frontend`: `npm.cmd test` passed 3/3 Node tests. |
| Frontend production build | PASS | `frontend`: `npm.cmd run build` completed successfully with Vite. |
| Browser registration/login/logout, direct URL, refresh, Back/Forward, and full staff/customer journeys | NOT TESTED | No live browser session was available for this audit. Before submission, run these flows against a local backend and MongoDB; verify both roles and direct URL refresh. |
| Responsive layout, overflow, loading/error rendering, and repeat-click behavior | NOT TESTED | These require visual/manual browser checks. Source uses busy states on mutation controls and renders loading/error messages, but visual behavior is not certified here. |
| Production API cross-origin cookie/CORS behavior | NOT TESTED | Backend has no CORS middleware; README requires deployment-specific credentialed CORS configuration. Configure an explicit frontend origin and verify credentials/cookie behavior over HTTPS before deploying. |

## Security and configuration

| Requirement | Status | Evidence and remaining action |
|---|---|---|
| `.env` and dependencies are ignored; no real environment file is tracked | PASS | `.gitignore` contains `.env` and `node_modules/`; `git check-ignore` confirms the local `backend/.env` is ignored; tracked-file scan found only `backend/.env.example` among environment files. Secret values were not read or copied. |
| No secrets or unrelated edits staged | PASS | Final staging is limited to the controller, regression test, and this checklist; unrelated pre-existing edits in `backend/.env.example` and `backend/src/server.js` remain unstaged. |
| Password hash, JWT, server errors, and security headers | PASS | Password hash has `select:false`; auth serializers whitelist fields; JWT is cookie-only; error middleware returns generic 500; Helmet is enabled and `x-powered-by` disabled. |
| Cookie and CORS settings match actual production origin | NOT TESTED | Cookie flags are source-verified; no production origin/deployment configuration was supplied. Browser-level third-party cookie policy and explicit CORS origin need deployment verification. |
| No wildcard credentialed CORS or browser token storage | PASS | Backend currently does not enable CORS; frontend uses `credentials: 'include'` and does not store tokens in web storage. Configure a specific allowed origin if frontend and API are deployed separately. |

## Build, documentation, and release readiness

| Requirement | Status | Evidence and remaining action |
|---|---|---|
| Backend full suite | PASS | `backend`: `npm.cmd test` passed after the fix: 4 suites and 35 tests. Tests use an isolated in-memory MongoDB. |
| Frontend tests and production build | PASS | `frontend`: `npm.cmd test` and `npm.cmd run build` passed after the fix. |
| Changed JavaScript syntax and whitespace checks | PASS | `node --check` on changed backend JavaScript and `git diff --check` passed. |
| Diff and secrets review | PASS | Explicit staged diff reviewed; no environment files, generated output, secrets, or unrelated edits included. |
| Release readiness | NOT TESTED | Automated checks pass, but browser and production-origin checks remain. Do not treat this checklist as a production deployment certification. |
