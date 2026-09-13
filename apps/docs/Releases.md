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
