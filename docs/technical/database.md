# Database

The database layer follows the SDD requirements for PostgreSQL + Prisma ORM.

## Implemented In This Phase

- Prisma datasource for PostgreSQL.
- Prisma Client generator.
- Domain enums for users, leagues, rounds, matches, guesses, rankings, payments,
  notifications and achievements.
- Core models:
  - `User`
  - `Account`
  - `Session`
  - `VerificationToken`
  - `League`
  - `LeagueMember`
  - `Championship`
  - `Season`
  - `Round`
  - `Team`
  - `Match`
  - `Guess`
  - `Score`
  - `Ranking`
  - `Payment`
  - `Notification`
  - `Badge`
  - `Achievement`
  - `AuditLog`
  - `Setting`
- Tables are mapped to snake_case through `@@map`.
- Database columns use snake_case through `@map` while TypeScript fields remain camelCase.
- Soft delete fields are present on critical business entities.
- One guess per user/match is enforced with a unique constraint.
- One achievement per user/badge is enforced with a unique constraint.
- Ranking, match, payment and audit query indexes are declared.
- A seed script creates platform settings, default scoring values, starter badges and an
  optional super admin from environment variables.

## Scoring Defaults

The seed stores the default business rule from the product documentation:

- winner hit: 3 points
- exact score bonus: 3 points
- joker multiplier: 2
- joker limit: 1 per round

Actual scoring execution will be implemented in the scoring phase.

## Local Validation Note

`pnpm prisma:validate` could not complete in this environment because pnpm is blocking
dependency build scripts until `pnpm approve-builds` is run for Prisma, Sharp and native
dependencies. Once approved locally, run:

```bash
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

No migration was applied in this phase because a live PostgreSQL connection was not part
of the current step.
