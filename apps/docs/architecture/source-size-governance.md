# Source-size governance

Source files have a boundary of 800 physical lines. This is a responsibility warning, not a style target: files approaching the boundary should be split around cohesive services, composables, stores, components, command adapters, or fixtures before they cross it.

The check scans JavaScript, TypeScript, Vue, and Rust source under `apps/`, `packages/`, and `scripts/`. Run it through Vite+:

```bash
vp run check:source-size
```

The reviewed exception register is `architecture/source-size-baseline.json`. Every exception records:

- Exact source path
- Approved maximum line count
- Accountable feature or runtime owner
- Narrow rationale and intended split direction

The current line count is the ceiling, not a renewable allowance. CI fails when:

- A source file crosses 800 lines without review
- An approved file grows beyond its recorded ceiling
- An exception lacks an owner or useful rationale
- An approved file disappears or returns to 800 lines or fewer without its stale entry being removed
- The baseline threshold is changed independently of the checker

When a split reduces a file to 800 lines or fewer, remove its exception in the same change. When exceptional growth is unavoidable, update the ceiling and rationale as an explicit architecture-review decision rather than a mechanical baseline refresh.
