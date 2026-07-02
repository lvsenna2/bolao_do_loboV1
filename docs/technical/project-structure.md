# Project Structure

This project follows a modular Next.js structure adapted from the official SDD.

## Main Areas

- `src/app`: App Router routes, layouts and route-level loading/error states.
- `src/components`: Shared UI, layout and feedback components.
- `src/features`: Feature-first modules for product areas such as guesses, ranking and admin.
- `src/server`: Server-only actions, auth, database access, repositories and services.
- `src/shared`: Cross-cutting schemas, types, utilities and config.
- `tests`: Unit, integration and end-to-end test suites.

## Implementation Rule

Each phase should add only the files required for that phase. Business logic belongs in
server services or feature modules, while reusable UI belongs in `src/components`.
