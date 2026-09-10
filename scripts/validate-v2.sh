#!/usr/bin/env bash
# Focused evidence is not a release qualification. All failures remain fatal.
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/validate-v2.sh [--targeted|--release] [--ruflo]
  --targeted  Crypto KEM tests, MCP library, DAG library tests, Node tests
              and local fixture benchmarks. Does not qualify a release.
  --release   Full workspace tests, full DAG library tests, Node tests,
              fixture benchmarks, and cargo audit --deny warnings.
  --ruflo     Also run pinned advisory Ruflo routing and crypto security scan.
Set QUDAG_V2_ARTIFACT_DIR to preserve logs in a chosen directory.
Otherwise a new temporary directory is created and its path printed.
USAGE
}
mode=targeted
ruflo=false
for argument in "$@"; do
  case "$argument" in
    --targeted) mode=targeted ;;
    --release) mode=release ;;
    --ruflo) ruflo=true ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
artifact_dir="${QUDAG_V2_ARTIFACT_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/qudag-v2.XXXXXX")}"
mkdir -p "$artifact_dir"
artifact_dir="$(cd "$artifact_dir" && pwd)"
printf 'Validation mode: %s\nArtifacts: %s\n' "$mode" "$artifact_dir"
command -v cargo >/dev/null
command -v node >/dev/null
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("Node >=22 required"); process.exit(1); }'
run_logged() {
  local label="$1"
  shift
  printf 'Running %s\n' "$label"
  "$@" 2>&1 | tee "$artifact_dir/$label.log"
}
if [[ "$mode" == targeted ]]; then
  run_logged crypto cargo test --locked -p qudag-crypto --lib --test ml_kem_v2 --test ml_kem_tests
  run_logged mcp cargo test --locked -p qudag-mcp --lib
  run_logged dag-library cargo test --locked -p qudag-dag --lib
else
  # Audit precedes compilation so workspace failures cannot hide advisory failures.
  # CI additionally executes audit as an independent mandatory job.
  run_logged dependency-audit cargo audit --deny warnings
  run_logged dag-full cargo test --locked -p qudag-dag --lib
  run_logged workspace-full cargo test --locked --workspace --all-targets
fi
run_logged federation-tests node --test integrations/ruflo-x/test.mjs
run_logged member-install npm ci --ignore-scripts --prefix integrations/ruflo-nostr
run_logged member-tests npm test --prefix integrations/ruflo-nostr
if [[ "$mode" == release ]]; then
  run_logged member-audit npm audit --omit=dev --prefix integrations/ruflo-nostr
fi
node integrations/ruflo-x/benchmark.mjs > "$artifact_dir/federation-benchmark.json"
cargo run --locked -p qudag-crypto --release --example ml_kem_v2_bench > "$artifact_dir/crypto-benchmark.json"
cargo run --locked -p qudag-dag --release --example v2_admission_bench > "$artifact_dir/dag-benchmark.json"
if [[ "$ruflo" == true ]]; then
  command -v npx >/dev/null
  # Advisory tooling never substitutes for tests or dependency advisory checks.
  # Capture output privately; do not echo scanner findings or credentials.
  (umask 077; npx -y @claude-flow/cli@3.25.6 hooks route --task 'completion: validate QuDAG v2 security and federation boundaries' > "$artifact_dir/ruflo-route.log" 2>&1)
  (umask 077; npx -y @claude-flow/cli@3.25.6 security scan --target core/crypto --depth deep --type all > "$artifact_dir/ruflo-security.log" 2>&1)
fi
printf 'Passed %s validation.\n' "$mode"
if [[ "$mode" == targeted ]]; then
  printf 'Release remains unqualified until full workspace tests and dependency audit pass.\n'
fi
