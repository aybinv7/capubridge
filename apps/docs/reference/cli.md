# CLI Commands

All tooling goes through `vp`. Never use `pnpm`, `npm`, or tool binaries directly.

## Development

```bash
# Install dependencies
vp install
# Run the Tauri desktop app
vp run tauri
# Run the website dev server
vp dev
# Format + lint + typecheck
vp check
# Run tests (watch mode)
vp test
```

## Build

```bash
# Build all packages
vp run -r build
# Check everything is ready
vp run ready
```

## Rules

- `vp check` replaces `vue- tsc`, `eslint`, `oxfmt`
- `vp test` replaces `vitest`
- Custom scripts: `vp run <script>`

## ADB bundle

```bash
# In apps/desktop/package.json
pnpm run bundle:adb  # Downloads platform-tools
```
