#!/usr/bin/env bash

set -e

SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
cd "${SCRIPT_DIR}"

for f in apps/*; do
    echo "rm -rf $f/node_modules $f/.next $f/.turbo"
    rm -rf $f/node_modules $f/.next $f/.turbo
done

for f in sub/*; do
    echo "rm -rf $f/node_modules $f/.turbo $f/dist"
    rm -rf $f/node_modules $f/.turbo $f/dist
done

echo "`pwd` : rm -rf node_modules"
rm -rf node_modules
