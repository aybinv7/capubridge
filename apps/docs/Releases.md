Trigger — push a tag like v1.0.0 or v1.2.0-beta.1

git tag v1.0.0
git push origin v1.0.0

What CI does — builds all 4 targets in parallel, uploads artifacts to a
draft GitHub release. You then open it on GitHub, edit the notes, and hit
Publish.

Auto notes — generateReleaseNotes: true pre-fills the draft with a commit
changelog. Edit before publishing.

Pre-release detection — tags with a - suffix (v1.0.0-beta.1) auto-mark as
pre-release.

desktop-build.yml now only runs on workflow_dispatch (manual trigger).

ex:

git push origin master
git tag v1.0.0-beta.1
git push origin v1.0.0-beta.1
