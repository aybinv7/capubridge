# Bottom Dock

The **Dock** is the persistent panel at the bottom of the app. It houses tools that run alongside any module — console output, logcat, REPL, and exceptions. Each tab can be popped out into its own standalone window.

## Logcat

Live Android system log stream. Starts automatically when a device session is open.

## Console

CDP-connected JavaScript console for the active target. Shows `console.*` output in real time.

## REPL

Interactive JavaScript REPL that evaluates against the active target via `Runtime.evaluate`.

## Exceptions

Unhandled exceptions captured from the target's CDP session. Each entry shows the stack trace and the source location.
