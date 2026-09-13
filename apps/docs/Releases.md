# Desktop releases

Root `package.json` is the release version source of truth. Before creating a release, synchronize the desktop package, Cargo manifest, Tauri configuration, visible status, and release notes with that version.

## Readiness

```bash
vp run check:versions
vp run test:all
vp run ready
```

`vp run ready` includes production builds and is the final maintainer-owned gate. The desktop build workflow can also be started manually without publishing a release.

## Tag and publish

Create the version-bump commit before the tag. Use an annotated semantic-version tag:

```bash
git tag -a v1.15.0 -m "CapuBridge v1.15.0"
git push origin v1.15.0
```

Pushing a matching tag starts the release workflow. CI verifies versions and tests first, then builds Linux, Windows, macOS Intel, and macOS Apple Silicon artifacts into a draft GitHub release.

Tags containing a suffix such as `v1.16.0-beta.1` are marked as prereleases. Release notes must be reviewed and grouped by user-facing capability before the draft is published.

## Supply chain and signing

Release builds download Android platform-tools and scrcpy only from versioned URLs recorded in `apps/desktop/scripts/release-resources.mjs`. Each archive is verified against its recorded upstream checksum before it replaces bundled resources. Updating either dependency requires an explicit manifest change and review.

Tauri updater artifacts are signed when `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` are configured in repository secrets. Windows Authenticode signing and macOS Developer ID signing/notarization are not configured by this repository. Do not claim platform installer trust outside Tauri updater verification until those credentials and CI steps exist.

Workflow actions are locked to these reviewed commits; update both commit and version context together during a dependency review:

| Action                    | Version context             | Commit                                     |
| ------------------------- | --------------------------- | ------------------------------------------ |
| `actions/checkout`        | v4                          | `11d5960a326750d5838078e36cf38b85af677262` |
| `actions/upload-artifact` | v4                          | `ea165f8d65b6e75b540449e92b4886f43607fa02` |
| `voidzero-dev/setup-vp`   | v1                          | `250f29ce396baf5e8f24498e17c0dfdebabc26eb` |
| `dtolnay/rust-toolchain`  | stable, resolved 2026-09-13 | `6bed0761d98439e5a578e2877258200ad565ba87` |
| `swatinem/rust-cache`     | v2                          | `6323deb102c322ba6fcbdcafc7e3dddab59af2b6` |
| `tauri-apps/tauri-action` | v0.6.2                      | `84b9d35b5fc46c1e45415bdb6144030364f7ebc5` |

## Owner release checklist

1. Confirm the release tag is annotated, matches the canonical version, and points to the reviewed commit.
2. Confirm the tag workflow’s quality and platform jobs passed; record their run URL and commit SHA in the draft release.
3. Download each draft artifact, record its SHA-256 alongside package name and target, then run install and launch smoke checks on its target platform.
4. Verify an update from the prior published version and a rollback plan before publishing. Tauri updater signature verification applies only when signing secrets were configured for the workflow.
5. Publish only after macOS notarization and Windows signing status are stated accurately in the release notes.
