# Cascadia Scorekeeper

An offline-first Progressive Web App for scoring Cascadia games.

## Features

- Score wildlife, habitat corridors, Nature Tokens, and habitat-majority bonuses.
- Autosave an active game locally and restore compatible saved-game schemas.
- Installable PWA with user-controlled updates.

## Development

```sh
pnpm install
pnpm run dev
pnpm run check
pnpm run test:coverage
pnpm run format:check
pnpm run icons:check
pnpm run build
```

Set `VITE_BASE` when validating a subpath deployment, for example
`VITE_BASE=/cascadia-scorer/ pnpm run build`.

## Architecture

- `src/lib/domain`: pure game types and scoring rules.
- `src/lib/persistence.ts`: versioned, validated device-local storage.
- `src/lib/pwa.ts`: service-worker lifecycle registration.
- `src/App.svelte`: application orchestration and game UI.

## Deployment

Pushes to `main` run formatting, icon, type, coverage, and production-build checks before
publishing to GitHub Pages. This project also retains its Sites hosting descriptor and server
artifact as a deployment-specific exception.

## License

MIT. Cascadia is a trademark of Flatout Games. This is an unofficial, non-affiliated fan
project.
