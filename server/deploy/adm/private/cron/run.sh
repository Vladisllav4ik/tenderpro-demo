#!/bin/sh
set -eu
umask 077
PRIVATE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ ! -r "$PRIVATE_DIR/php-cli.path" ]; then
    printf '%s\n' 'Set private/php-cli.path to the verified PHP 8.3 CLI executable.' >&2
    exit 1
fi
PHP_CLI=$(head -n 1 "$PRIVATE_DIR/php-cli.path" | tr -d '\r')
if [ -z "$PHP_CLI" ]; then exit 1; fi
case "${1:-forward}" in
    forward) exec "$PHP_CLI" "$PRIVATE_DIR/cron/collect.php" --profile=1 --mode=forward --limit=100 --seconds=60 ;;
    first) exec "$PHP_CLI" "$PRIVATE_DIR/cron/first-scan.php" ;;
    preflight) exec "$PHP_CLI" "$PRIVATE_DIR/bin/preflight.php" ;;
    *) printf '%s\n' 'Allowed modes: forward, first, preflight' >&2; exit 1 ;;
esac
