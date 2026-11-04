# Vendored cladd-vue

This package is a vendored copy of [cladd-vue](https://github.com/aybinv7/cladd-vue) `packages/ui`.
Do not edit `src/` here: add or fix primitives in cladd-vue (where they are parity-tested against
upstream Cladd), commit there, then run `node scripts/sync-cladd.mjs` from the repo root.

- cladd-vue commit: `24e225e18c480ca6e6e5596d4f792e4d1508604d`
- Upstream Cladd pin: `1aaad0ac5b13541823ed876a227949fcc806ca5e`
- Left in cladd-vue: the calendar components (need `@vuepic/vue-datepicker`; only their type
  contracts are vendored) and the parity suite
  (needs `reference/cladd` and the port manifests).
