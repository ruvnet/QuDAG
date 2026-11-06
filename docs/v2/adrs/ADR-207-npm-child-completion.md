# ADR 207: Preserve failed child completion in npm consumers

Status: proposed, 2026-09-26. Related release qualification: issue #17.

## Context

Both the shipped CLI and programmatic `execute` wrapper map a native child's
missing numeric exit code to zero. Node reports a null exit code when a child
terminates from a signal. A cancelled or killed command can therefore appear
successful to shell automation and API callers. This is independent of the
existing release asset and full workspace qualification gaps.

## Decision

Preserve every numeric exit code unchanged. Map an absent numeric code to the
existing generic failure code 1. Wait for `close`, which follows process exit
and stdio closure, before resolving captured output. Keep spawn errors on the
existing failure/rejection path. No signal handler, release, workflow, native
binary, authorization, or dependency policy is changed.

The API continues to return a numeric `code`. It does not claim to expose the
original signal identity or POSIX signal-derived exit numbers. This avoids an
API shape change and works with the package's existing Node >=16 support.

## Authoritative source and applicability

The current Node child-process contract, retrieved 2026-09-26, distinguishes
numeric exit codes from signal termination and documents that streams may
remain open at `exit`: https://nodejs.org/api/child_process.html#event-close
and https://nodejs.org/api/child_process.html#event-exit.

This is a stable process contract, not a new algorithmic SOTA claim. Current
documentation also offers newer signal-conversion helpers; using a new runtime
API would break the declared Node support floor, so the compatible null check
is the smallest applicable repair.

## Validation and limits

From `qudag-npm`, install the committed dependencies without lifecycle scripts,
build, and compile the TypeScript regression:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
./node_modules/.bin/tsc --module commonjs --target es2020 --esModuleInterop --skipLibCheck --outDir test-dist tests/process-status.test.ts
node --test test-dist/process-status.test.js
```

The fixture copies the actual built package to a temporary directory and
substitutes only the native executable with a harmless local Node process.
It tests ordinary exits 0 and 7, SIGTERM/SIGINT/SIGKILL in both consumers,
complete 256 KiB stdout and stderr, and a non-executable native file. No live
network, production process, or credential is used. `QUDAG_TEST_PACKAGE` may
point at a separately installed packed package for final-consumer replay.

The baseline passed 6 of 12 cases: all six signal cases falsely succeeded.
The acceptance threshold is all 12 cases passing in the source build and a
cleanly installed packed artifact, without modifying the test expectations.
These executable-fixture tests target POSIX systems; Windows and native binary
qualification remain separate. Passing this focused repair does not qualify
QuDAG for release or resolve the dependency audit and missing release assets.
