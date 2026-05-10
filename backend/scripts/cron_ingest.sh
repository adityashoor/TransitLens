#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

"$ROOT/.venv/bin/python" -m transitlens_gtfs.cli ingest --download --force-download --strict
