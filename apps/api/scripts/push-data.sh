#!/usr/bin/env bash
# Copies the data of the local database (docker compose) into a production database.
#
# Usage: pnpm push-data   (from the repository root)
#
# The production app must have started once on an empty database, so its tables exist. The production
# ENCRYPTION_KEY must be the local one, otherwise the copied data cannot be decrypted.
# Asks for the production admin connection URL (Northflank: EXTERNAL_POSTGRES_URI_ADMIN, with public access
# enabled on the addon). Passkeys and sessions are not copied: they belong to the local address; sign in on
# production with scripts/access-link.ts.
set -euo pipefail

LOCAL_CONTAINER=invoom-db-1
TABLES=(users workspaces workspace_members recovery_codes settings clients services payments invoice_files deadlines platforms)
# Business tables under FORCE row-level security: lifted during the copy so the owner can insert without
# being a superuser, then restored, all in the same transaction
FORCED=(settings clients services payments invoice_files deadlines platforms)

if ! docker exec "$LOCAL_CONTAINER" pg_isready -q 2>/dev/null; then
    echo "La base locale ne tourne pas : lance Docker puis 'pnpm services'." >&2
    exit 1
fi

read -r -s -p "URL admin de la base de production : " TARGET
echo
[[ "$TARGET" == *sslmode=* ]] || TARGET="${TARGET}$([[ "$TARGET" == *\?* ]] && echo '&' || echo '?')sslmode=require"

# psql from Homebrew (brew install libpq) when available, otherwise the one in the local container
if command -v psql >/dev/null; then
    PSQL=(psql)
elif [[ -x /opt/homebrew/opt/libpq/bin/psql ]]; then
    PSQL=(/opt/homebrew/opt/libpq/bin/psql)
else
    PSQL=(docker exec -i "$LOCAL_CONTAINER" psql)
fi

dump_args=()
for t in "${TABLES[@]}"; do dump_args+=(-t "public.$t"); done

existing=$("${PSQL[@]}" "$TARGET" -Atc "select count(*) from public.users")
if [[ "$existing" != "0" ]]; then
    echo "La base de production contient déjà $existing compte(s) : copie annulée." >&2
    exit 1
fi

echo "Copie en cours…"
{
    echo "\\set ON_ERROR_STOP on"
    echo "BEGIN;"
    for t in "${FORCED[@]}"; do echo "ALTER TABLE public.$t NO FORCE ROW LEVEL SECURITY;"; done
    docker exec "$LOCAL_CONTAINER" pg_dump -U invoom --data-only --no-owner --no-privileges "${dump_args[@]}" invoom
    for t in "${FORCED[@]}"; do echo "ALTER TABLE public.$t FORCE ROW LEVEL SECURITY;"; done
    echo "COMMIT;"
} | "${PSQL[@]}" "$TARGET" -q >/dev/null

# Counted on the local side: in production the business tables are only visible inside a workspace
count() { docker exec "$LOCAL_CONTAINER" psql -U invoom -d invoom -Atc "select count(*) from public.$1"; }
echo "Copié : $(count clients) client(s), $(count payments) paiement(s), $(count invoice_files) fichier(s), $(count services) prestation(s), $(count deadlines) rappel(s)."
echo "Terminé. Connecte-toi avec : node scripts/access-link.ts --email <ton e-mail> https://<ton domaine>"
