#!/usr/bin/env bash

set -Eeuo pipefail
shopt -s nullglob

DRY_RUN=false

case "${1:-}" in
    --dry-run|-n)
        DRY_RUN=true
        ;;
    --help|-h)
        echo "Usage: $0 [--dry-run]"
        exit 0
        ;;
    "")
        ;;
    *)
        echo "Unknown option: $1" >&2
        echo "Usage: $0 [--dry-run]" >&2
        exit 2
        ;;
esac

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd "${SCRIPT_DIR}"

purge() {
    if [ "$#" -eq 0 ]; then
        return
    fi

    if [ "${DRY_RUN}" = true ]; then
        echo "[dry-run] rm -rf $*"
        return
    fi

    echo "rm -rf $*"
    rm -rf -- "$@"
}

for f in apps/*; do
    purge "$f/node_modules" "$f/.next" "$f/.turbo" "$f/dist"
done

for f in sub/*; do
    purge "$f/node_modules" "$f/.turbo" "$f/dist" "$f/coverage" "$f/test-results" "$f/llm.txt"
done

echo "$(pwd) : purge root artifacts"
purge node_modules .turbo
