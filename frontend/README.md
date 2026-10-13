# Frontend

React Router 8 (SSR) with Mantine, TanStack Query and i18next.

## Layout

- `app/`: routes, modules and the i18n files (`app/i18n/{en,pt-PT}`).
- `packages/core`, `packages/ui`, `packages/booking`: workspaces imported as `@internal/*`. `booking` holds the React-free booking editor logic.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build / serve it |
| `npm run typecheck` | `react-router typegen && tsc` |
| `npm test` | Node test runner, including the i18n key check |
| `npm run format` | prettier |

Build with `NODE_OPTIONS=--dns-result-order=ipv4first` (see `Dockerfile`). Run typecheck and tests in a `node:22` container with `node_modules` in a named volume, as `CLAUDE.md` says.

## Docs

- [i18n](../docs/i18n.md): adding text and languages.
- [Appointments](../docs/appointments.md): the booking editor and public form.
