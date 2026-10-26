# Product Requirements Document

RepairTrace — Product Requirements Document (PRD)
Document version: 0.1
Status: Proposed MVP; scope intentionally narrow
Last updated: 26 October 2026
Submission deadline: 27 October 2026, 11:59 PM IST
Product type: Web application
Primary stack: MongoDB, Express, React, Node.js (MERN)
## 1. Executive Summary
RepairTrace is a repair-workflow and accountability platform for small independent laptop and phone repair shops. It keeps a repair's important information in one place: device intake and condition, diagnosis, itemized quotation, customer approval, repair progress, quality verification, and handover.

The product is not intended to be a full point-of-sale, accounting, inventory, or enterprise repair-management system. The MVP focuses on enforcing a reliable repair lifecycle and preserving an auditable record of decisions.
### Problem statement
Small repair shops may track customer information, device condition, diagnoses, prices, approvals, parts delays, and updates across paper notes and separate messages. This makes it difficult to know what work was authorized, why a repair is blocked, what has been completed, and whether the device was properly returned.
### Proposed solution
A single application in which staff manage repair orders and customers can securely view their own repair, approve or decline a quotation, and follow progress. The backend—not merely the frontend—enforces the rules that determine whether a repair can move to its next state.
### Product principles
1. Correctness before feature count. A smaller number of complete workflows is better than many incomplete screens.
2. Server-enforced rules. Hiding a button in React is not authorization; the API must validate every sensitive action.
3. Preserve decisions. Important approvals and lifecycle events should not be silently overwritten.
4. No unnecessary integrations. No payment gateway, SMS provider, AI diagnosis, or supplier integration is needed for the MVP.
5. Understandable engineering. The developer must be able to explain the data model, API, security choices, and key business rules in a viva.
## 2. Goals and Non-Goals
### Goals
- Maintain one persistent repair record from intake to handover.
- Give each repair a unique, sequential application-generated repair number.
- Record the device's initial reported condition and intake checklist.
- Ensure work requiring customer approval cannot proceed until the applicable quote is approved.
- Track repair status and blockers clearly.
- Record quality checks and handover before closure.
- Separate customer permissions from staff permissions.
- Deliver a deployed, documented application with a meaningful Git commit history and a 3–5 minute demo.
### Non-goals for the deadline MVP
- Online payments, invoicing/accounting, POS, or tax calculations.
- Full parts inventory, supplier purchasing, or stock forecasting.
- SMS/WhatsApp/email delivery integrations.
- AI fault diagnosis or AI-generated repair estimates.
- Multiple shop branches, complex staff scheduling, or route planning.
- Native mobile apps.
- Supporting every repair category. The initial product is for laptops and phones only.
- Claiming that the product is commercially production-ready or independently security-audited.
## 3. Target Users and Permissions
### Staff (shop owner/front desk/technician)
Staff can sign in, create and manage repair orders, record diagnosis, prepare quotations, update repair work, complete quality checks, and record handover, subject to role permissions.

For the deadline MVP, staff roles may be simplified to a single staff role if finer technician/owner permissions would delay completion. The data model should not expose staff privileges through public registration.
### Customer
A customer can register, sign in, view only repairs belonging to their account, view quote details, approve or decline a quote, and view customer-safe status updates. A customer cannot create staff accounts, see another customer's repair, edit diagnosis, change internal status, or mark a repair returned.
### Account provisioning rule
Public registration creates a customer account only. The API must not accept a client-supplied role as authority to create a staff/admin account. Staff accounts should be provisioned using a controlled seed/bootstrap process or another explicitly protected mechanism.
## 4. MVP Workflows
Workflow 1 — Device intake
1. Staff selects an existing customer or records the required customer details according to the account model.
2. Staff records device category (laptop/phone), brand/model, optional manufacturer serial/IMEI where appropriate, reported issue, visible condition, included accessories, and intake notes.
3. The server assigns a unique repair reference.
4. The repair appears in the staff queue and is linked to the correct customer.
Rules: Required intake fields are validated server-side. The application-generated repair reference is distinct from the manufacturer's device serial number. Clients cannot choose or alter the repair reference.
Workflow 2 — Diagnosis, quotation, and customer decision
1. Staff/technician records diagnosis and proposed work.
2. Staff creates an itemized quote with line descriptions, quantities where applicable, and prices.
3. The customer sees the quote and chooses approve or decline.
4. The system records the decision and the exact quote version to which it applies.
5. If proposed work or price changes after approval, a new quote version requires a new approval before the changed work can proceed.
Rules: Declined or pending quotes do not authorize repair work. Quote totals are calculated and validated on the server; the server does not trust a total supplied by the client.
Workflow 3 — Repair progress and blockers
1. Staff moves a repair through allowed statuses.
2. Staff records updates such as diagnosis complete, awaiting approval, awaiting part, repair in progress, or ready for quality check.
3. A blocker is visible in the staff queue and customer-safe updates are shown to the customer.
Rules: Only allowed state transitions are accepted. A status update cannot bypass a required approval or prerequisite. Internal notes are never included in customer-facing responses.
Workflow 4 — Quality verification and handover
1. Technician records the required repair-specific checks and results.
2. Staff marks the repair ready for collection only when required checks pass.
3. Staff records the handover date/time and handover confirmation.
4. The repair is marked returned/closed.
Rules: A repair cannot be marked returned without a completed handover record. Failed quality checks must be recorded and must prevent closure until resolved or an explicitly designed exception is handled.
Workflow 5 — History and repeat issues
The repair detail page presents a chronological history of important events: intake, quote versions and decisions, status changes, work updates, quality-check results, and handover. A repeat repair may optionally link to an earlier repair if time permits.

MVP priority: The event/history trail is more important than a sophisticated repeat-repair feature. If time is tight, defer linking repeat repairs but preserve audit events.
## 5. Repair Status Model
### Proposed states
- received
- diagnosing
- awaiting_customer_approval
- awaiting_parts
- in_repair
- quality_check
- ready_for_collection
- returned
- cancelled
The implementation must define allowed transitions explicitly. Examples:
- received → diagnosing
- diagnosing → awaiting_customer_approval
- awaiting_customer_approval → in_repair only when the applicable quote is approved
- in_repair → awaiting_parts when work is blocked by a required part
- in_repair → quality_check when work is complete
- quality_check → in_repair if a check fails, or ready_for_collection if all required checks pass
- ready_for_collection → returned only after handover is recorded
- cancellation must follow an explicit rule and must not erase history
This list is a proposed starting point, not permission to implement every state in the first registration-only milestone. All transition checks belong on the server.
## 6. Functional Requirements and Acceptance Criteria
Priority labels: P0 = required for submission MVP, P1 = only if P0 is stable, Later = post-submission.
### Authentication and accounts
- AUTH-01 (P0): A visitor can register using name, email, phone number, and password.
- AUTH-02 (P0): Name, email, phone, and password are validated server-side; invalid input returns a clear 4xx response and does not create a user.
- AUTH-03 (P0): Email is trimmed and normalized to lowercase before persistence; the database enforces email uniqueness.
- AUTH-04 (P0): Passwords are hashed before storage. Plaintext passwords and password hashes are never returned by an API.
- AUTH-05 (P0): Public registration always creates a customer. A client-supplied role cannot create staff/admin privileges.
- AUTH-06 (P0): Duplicate email registration returns a conflict response without leaking database details.
- AUTH-07 (P0): Login, logout/session handling, protected API routes, and access control are implemented before the complete customer/staff frontend is considered complete.
- AUTH-08 (P0): A customer can access only repairs linked to their account. Staff-only actions reject customer access.
### Repair orders
- REP-01 (P0): Staff can create a repair order with the required intake details.
- REP-02 (P0): The server assigns unique sequential repair references starting with R-000001 for the first repair, then R-000002, etc. The manufacturer serial/IMEI is a separate optional field and is not the repair reference.
- REP-03 (P0): Repair references are generated atomically on the server to avoid collisions under concurrent requests. A failed/cancelled operation may leave a gap; references must be unique and increasing, not necessarily gapless.
- REP-04 (P0): Staff can search/filter the repair queue by repair reference, status, and customer/device details where appropriate.
- REP-05 (P0): Repair details and status history persist in MongoDB and survive application restart.
### Quotes and approvals
- QUO-01 (P0): Staff can create an itemized quotation associated with a repair.
- QUO-02 (P0): The customer can approve or decline only a quote belonging to their own repair.
- QUO-03 (P0): The decision records the quote version, actor, and timestamp.
- QUO-04 (P0): Repair work that requires customer authorization cannot begin while the applicable quote is pending or declined.
- QUO-05 (P0): A revised quote invalidates the prior approval for changed work and requires a new decision.
### Progress and closure
- OPS-01 (P0): The backend accepts only defined status transitions.
- OPS-02 (P0): Blockers such as waiting for customer approval or a part are visible to staff.
- OPS-03 (P0): Important status and approval events are appended to history; they cannot be silently edited away through ordinary update endpoints.
- OPS-04 (P0): Required quality checks must pass before the repair becomes ready for collection.
- OPS-05 (P0): Handover details are required before marking a repair returned.
- OPS-06 (P1): Staff can link a new repair to a prior repair for the same device/customer.
### User experience and reliability
- UX-01 (P0): The interface clearly distinguishes loading, empty, success, and error states.
- UX-02 (P0): The application explains validation failures in useful language without exposing stack traces or secrets.
- UX-03 (P0): A customer sees only customer-safe fields and never internal staff notes.
- UX-04 (P0): The README gives clean local setup instructions and lists environment variables without values of real secrets.
## 7. Initial Backend Registration Milestone (First Codex Task)
This is the immediate task only. Do not build the frontend or future repair features in this milestone.
### Deliverable
An Express application using a small MVC-style structure, connected to MongoDB/Mongoose, with a working customer-registration endpoint and basic health endpoint.
### Required endpoints
- GET /api/health — returns a small health response; database readiness should be represented accurately if implemented as a database-dependent check.
- POST /api/auth/register — validates and creates a customer user.
### Registration input

```json
{
  "name": "Example Customer",
  "email": "customer@example.com",
  "phone": "+919876543210",
  "password": "Example-Password-123"
}

```
The example is illustrative only; never hardcode or reuse it as a real account.
### Registration behavior
- Trim name and email; normalize email to lowercase.
- Require a plausible name, valid email, valid international phone number in E.164 format, and a password of at least 8 characters.
- If bcrypt is selected, reject passwords exceeding its supported input byte length rather than silently truncating them.
- Hash the password before saving (use a suitable password-hashing library and documented work factor).
- Always assign role customer on the server; reject or ignore any attempt to supply a privileged role. Prefer rejecting unexpected role input with a validation response.
- Store a unique index on normalized email and handle a duplicate-key race cleanly with HTTP 409.
- Do not return password or passwordHash in responses.
- Do not implement login, JWT/session issuance, password reset, frontend, repair model, quote model, or repair endpoints in this first task.
- Add a few tests for valid registration, invalid email, invalid phone, weak/missing password, duplicate email, and role escalation attempt. Tests must use a test database/configuration and must not depend on real credentials.
### Suggested folder structure

```text
repairtrace/
├── AGENTS.md
├── README.md
├── .gitignore
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── models/
│   │   │   └── User.js
│   │   ├── controllers/
│   │   │   └── authController.js
│   │   ├── routes/
│   │   │   └── authRoutes.js
│   │   ├── middleware/
│   │   │   └── errorHandler.js
│   │   └── validators/
│   │       └── authValidators.js
│   └── tests/
│       └── auth.register.test.js
└── docs/
    └── PRD.md

```
Keep this intentionally small. Add helpers only if they solve a real need. Use either ES modules or CommonJS consistently; do not mix module systems.
## 8. Technical Requirements and Proposed Architecture
### Backend
- Node.js LTS and Express.
- Mongoose for schema validation and MongoDB persistence.
- MVC-style separation: routes map URLs, controllers coordinate request/response behavior, models define persisted data, middleware handles cross-cutting concerns, and config handles database setup.
- Centralized error handling; no raw stack traces in production responses.
- Request body size limit, security headers, and reasonable rate limiting for registration.
- CORS should be configured explicitly when the React frontend is introduced; do not use a permissive production wildcard with credentials.
### Frontend (later milestone)
- React with Vite and Tailwind CSS.
- Separate customer and staff views, using protected routes for UX while relying on backend authorization as the actual security boundary.
- A shared API module with consistent error handling and environment-based backend URL.
### Database (evolving schema)
- User: name, normalized email, phone, password hash, role, created/updated timestamps.
- Repair: sequential repair reference, customer reference, device category, brand/model, optional manufacturer serial number, reported issue, condition/accessories, diagnosis, status, assigned staff, timestamps.
- Quote version: repair reference, version number, line items, server-calculated total, status, created by, customer decision, decision timestamp.
- Repair event: repair reference, event type, actor, timestamp, and safe event details.
- Quality check/handover: checks and outcomes, handover time, staff actor, and customer confirmation details as appropriate.
- Repair counter: one counter document updated atomically to generate the next repair number.
These later models must not be built during the initial registration-only task.
### API conventions
- Use consistent JSON responses and correct HTTP status codes.
- Validate at the API boundary and repeat important invariants in the data layer where possible.
- Never trust customer ID, role, quote total, repair number, approval actor, or status if the client can manipulate it.
- Filter customer queries by the authenticated customer ID on the server.
- Return only safe fields; never serialize password hashes or internal notes into customer responses.
## 9. Non-Functional Requirements
### Security and privacy
- No plaintext passwords.
- No secrets or real .env files committed to Git.
- Validate and normalize all user input.
- Use least-privilege role checks for protected endpoints.
- Avoid logging passwords, tokens, or sensitive customer evidence.
- Do not expose customer records through predictable IDs without authorization.
- Use environment variables for runtime configuration and document only variable names in .env.example.
### Reliability and errors
- Invalid inputs produce clear 4xx errors.
- Duplicate registrations are handled without unhandled server errors.
- Database connection failures prevent the server from falsely reporting full readiness.
- Failed operations do not leave an order in an invalid state.
- Network/API failures are visible in the UI and do not silently appear successful.
### Maintainability
- Meaningful, small commits.
- Clear MVC boundaries and consistent naming.
- Automated tests for critical validation and business rules.
- README with stack, architecture, setup, environment variables, deployment, and demo instructions.
### Performance targets
For a single-shop demo with a small test dataset, normal API requests should usually complete within 500 ms on the local development environment, excluding cold starts and external database/network delays. This is a development target, not a production SLA.
## 10. Error and Edge-Case Requirements
- Invalid/missing registration fields: reject without creating a user.
- Duplicate normalized email: return conflict, including when two concurrent requests race.
- Privileged role supplied during public registration: reject; never grant that role.
- MongoDB unavailable: return an appropriate service error and log diagnostic detail server-side.
- Wrong user attempts to inspect or approve another customer's repair: deny access.
- Quote changed after approval: require fresh approval for changed scope/cost.
- Repair moved into a disallowed status: reject and preserve current valid state.
- Quality check fails: do not allow ready-for-collection/returned state.
- Handover missing: do not allow returned/closed state.
- Client submits an incorrect repair number or quote total: ignore/reject client-controlled values; calculate/assign server-side.
- User refreshes after a successful write: persisted state must still be correct.
## 11. Success Metrics and Acceptance Gate
The project is considered submission-ready only when:
1. A clean setup can start the backend and later frontend using the documented instructions.
2. Registration validation tests pass, the password is hashed, and the response does not contain a password/hash.
3. A customer cannot create staff privileges or access another customer's repairs.
4. A repair can be followed from intake through authorized work, quality verification, and handover in one end-to-end demo.
5. Core invalid transitions are rejected by the backend and have tests or reproducible test steps.
6. MongoDB persistence survives application restart.
7. The deployed application/build, repository, README, and demo are accessible to evaluators.
8. Git history contains meaningful changes across development milestones, with no committed secrets.
9. The 3–5 minute demo shows the problem, the major workflow, and the working result.
10. The official submission form is completed before the deadline.
## 12. Implementation Plan and Feature Freeze
The deadline is close; every phase must end with a working checkpoint. If time becomes short, defer P1 features rather than weakening core validation.
1. Milestone 0 — Repository baseline: Create GitHub repo, local clone, README, PRD, .gitignore, and root AGENTS.md.
2. Milestone 1 — Registration API only (current task): Express app, MongoDB connection, User model, validators, controller, routes, error handler, health endpoint, tests. No frontend.
3. Milestone 2 — Authentication and role protection: Login, logout/session strategy, current-user endpoint, protected staff/customer authorization. Do not store tokens insecurely or expose privileged registration.
4. Milestone 3 — Repair intake: Repair model, atomic repair counter, staff-only create/list/detail endpoints.
5. Milestone 4 — Quotation and approval: Versioned quote, customer approve/decline, backend-enforced authorization prerequisite.
6. Milestone 5 — Progress and closure: State transitions, event history, quality checks, handover.
7. Milestone 6 — React integration: Minimum staff console and customer repair/quote view; loading/error/empty states.
8. Milestone 7 — Verification and submission: End-to-end test, deployment, README, short demo, accessible links, submission form.
Feature-freeze rule: Once all P0 workflows are working, stop adding features. Use remaining time for bug fixes, clean setup verification, demo, and submission links.
## 13. Risks and Mitigations
| Risk | Mitigation |
| --- | --- |
| Codex usage runs out mid-task | Work in small milestones, commit/push after passing checks, preserve local repo state, check usage before large tasks. |
| Generated code compiles but workflows are broken | Require tests and manually test one full customer journey after each integration milestone. |
| Scope expands | No new feature unless P0 workflow is already complete. |
| Public registration grants staff role | Hard-code public registration role to customer; use controlled staff provisioning. |
| Repair sequence collision | Use atomic counter update and a unique database index. |
| Secrets committed to GitHub | .env ignored, .env.example has placeholders, inspect staged diff before commit/push. |
| Deadline lost to deployment | Deploy early once the first integrated full journey works; leave explicit time for final form/video/link checks. |
| Developer cannot explain generated code | Require Codex to explain files, flow, and key decisions after each milestone; practice viva questions. |


## 14. Open Questions / Decisions
### Decisions for the deadline MVP
- Shop model: one repair shop, not multi-tenant SaaS.
- Device scope: laptops and phones only.
- Repair reference: application-generated R-000001, independent of the manufacturer's serial number.
- Public registration role: customer only.
- Staff accounts: provisioned through a controlled seed/bootstrap process; never self-assigned publicly.
- Customer access: authenticated account for the intended end state. A secure opaque tracking link is a possible fallback only if time constraints require it.
- External services: none required for core workflows.
- Payment: not included in the deadline MVP.
- Photos: defer uploads if they risk delaying core lifecycle correctness; intake condition can initially be recorded as structured checklist and notes.
- Repeat repair links: P1; retain event history first.
## 15. Revision History
| Version | Date | Change |
| --- | --- | --- |
| 0.1 | 26 Oct 2026 | Initial proposed PRD; scope limited to independent laptop/phone repair workflow and deadline MVP. |
