#!/usr/bin/env bash

set -e

SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
cd "${SCRIPT_DIR}"

../_dist.sh && rm -rf node_modules/@cp949/web-image-util node_modules/.cache && yarn add ../dist && yarn dev
