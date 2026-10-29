#!/usr/bin/env bash
# Walks through the whole system with curl. Needs the stack:  docker compose up --build
# Uses only curl, base64 and node (to read JSON). Safe to run many times.
#
#   ./scripts/smoke.sh                         # gateway on http://localhost:8081, mock provider on :9000
#   BASE=http://localhost:8081 ./scripts/smoke.sh

set -euo pipefail

BASE="${BASE:-http://localhost:8081}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
ok() { printf '   ok: %s\n' "$1"; }
fail() { printf '   FAILED: %s\n' "$1" >&2; exit 1; }

# json '<javascript path>' reads JSON from stdin, for example: echo "$X" | json '.user.id'
json() { node -pe "JSON.parse(require('fs').readFileSync(0, 'utf8'))$1"; }

# call METHOD URL TOKEN [curl args]  ->  prints the body, writes the status code to $WORK/status
call() {
  local method="$1" url="$2" token="$3"
  shift 3
  local auth=()
  [ -n "$token" ] && auth=(-H "Authorization: Bearer $token")
  curl -sS -X "$method" ${auth[@]+"${auth[@]}"} -o "$WORK/body" -w '%{http_code}' "$@" "$url" > "$WORK/status"
  cat "$WORK/body"
}
status() { cat "$WORK/status"; }
expect_status() { [ "$(status)" = "$1" ] || { cat "$WORK/body" >&2; fail "$2 (expected HTTP $1, got $(status))"; }; ok "$2 -> HTTP $1"; }

# login_as <mock user>: runs the OAuth flow like a browser: /login, approve at the provider, /callback.
# curl -L follows both redirects. The cookie jar carries the httpOnly state cookie.
login_as() {
  local who="$1" jar="$WORK/jar-$1" authorize_url
  authorize_url="$(curl -sS -c "$jar" -o /dev/null -w '%{redirect_url}' "$BASE/api/auth/github/login")"
  [ -n "$authorize_url" ] || fail "login for $who did not redirect to the provider"
  curl -sS -L -b "$jar" -c "$jar" "${authorize_url}&login=${who}"
}

# ------------------------------------------------------------------------------
step "1. Gateway and service health"
for path in /api/auth/health /api/profiles/health /api/catalog/health; do
  call GET "$BASE$path" "" > /dev/null
  expect_status 200 "GET $path"
done

# ------------------------------------------------------------------------------
step "2. Login through the mock OAuth provider (three users)"
ALICE_LOGIN="$(login_as alice)"
BOB_LOGIN="$(login_as bob)"
CAROL_LOGIN="$(login_as carol)"
ALICE="$(echo "$ALICE_LOGIN" | json '.accessToken')"
BOB="$(echo "$BOB_LOGIN" | json '.accessToken')"
CAROL="$(echo "$CAROL_LOGIN" | json '.accessToken')"
ALICE_REFRESH="$(echo "$ALICE_LOGIN" | json '.refreshToken')"
ALICE_ID="$(echo "$ALICE_LOGIN" | json '.user.id')"
ok "alice is user $ALICE_ID, token length ${#ALICE}"

call GET "$BASE/api/auth/me" "$ALICE" > /dev/null
expect_status 200 "GET /api/auth/me"
call GET "$BASE/api/auth/me" "" > /dev/null
expect_status 401 "GET /api/auth/me without a token is refused"
call GET "$BASE/api/auth/providers" "" > /dev/null
expect_status 200 "GET /api/auth/providers"

step "3. Refresh token rotation and reuse detection"
ROTATED="$(call POST "$BASE/api/auth/refresh" "" -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$ALICE_REFRESH\"}")"
expect_status 200 "POST /api/auth/refresh with the first refresh token"
NEW_REFRESH="$(echo "$ROTATED" | json '.refreshToken')"
[ "$NEW_REFRESH" != "$ALICE_REFRESH" ] || fail "refresh token was not rotated"
call POST "$BASE/api/auth/refresh" "" -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$ALICE_REFRESH\"}" > /dev/null
expect_status 401 "the old refresh token is refused (reuse detected, session revoked)"
call POST "$BASE/api/auth/refresh" "" -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$NEW_REFRESH\"}" > /dev/null
expect_status 401 "the newest token of that session is dead too"
call GET "$BASE/api/auth/sessions" "$ALICE" > /dev/null
expect_status 200 "GET /api/auth/sessions"

# ------------------------------------------------------------------------------
step "4. Profiles: first access creates the profile"
PROFILE="$(call GET "$BASE/api/profiles/me" "$ALICE")"
expect_status 200 "GET /api/profiles/me"
HANDLE="$(echo "$PROFILE" | json '.handle')"
ok "profile created with handle '$HANDLE'"

call PUT "$BASE/api/profiles/me" "$ALICE" -H 'Content-Type: application/json' \
  -d '{"displayName":"Alice Moroz","bio":"Backend engineer who loves MongoDB","location":"Mykolaiv","links":[{"label":"GitHub","url":"https://github.com/alice"}]}' > /dev/null
expect_status 200 "PUT /api/profiles/me"
call PATCH "$BASE/api/profiles/me/preferences" "$ALICE" -H 'Content-Type: application/json' -d '{"theme":"dark","language":"uk-UA"}' > /dev/null
expect_status 200 "PATCH /api/profiles/me/preferences"

call GET "$BASE/api/profiles/me" "$BOB" > /dev/null
call PUT "$BASE/api/profiles/me" "$BOB" -H 'Content-Type: application/json' -d "{\"displayName\":\"Bob\",\"handle\":\"$HANDLE\"}" > /dev/null
expect_status 409 "Bob cannot take Alice's handle (unique index -> 409)"

step "5. Avatar upload (checked by magic bytes)"
echo 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==' | base64 -d > "$WORK/avatar.png"
echo 'this is not an image' > "$WORK/fake.png"
UPLOADED="$(call POST "$BASE/api/profiles/me/avatar" "$ALICE" -F "avatar=@$WORK/avatar.png;type=image/png")"
expect_status 201 "POST /api/profiles/me/avatar with a real PNG"
AVATAR_URL="$(echo "$UPLOADED" | json '.avatar.url')"
call GET "$BASE$AVATAR_URL" "" > /dev/null
expect_status 200 "GET $AVATAR_URL"
call POST "$BASE/api/profiles/me/avatar" "$ALICE" -F "avatar=@$WORK/fake.png;type=image/png" > /dev/null
expect_status 415 "a text file that claims to be image/png is refused"

call GET "$BASE/api/profiles/$HANDLE" "" > /dev/null
expect_status 200 "GET /api/profiles/$HANDLE (public)"
SEARCH="$(call GET "$BASE/api/profiles?q=mongodb&page=1&pageSize=5" "")"
expect_status 200 "GET /api/profiles?q=mongodb"
ok "search found $(echo "$SEARCH" | json '.total') profile(s)"

# ------------------------------------------------------------------------------
step "6. Catalog: create and publish 12 items"
ITEM_IDS=()
FIRST_SLUG=""
for i in $(seq 1 12); do
  case $((i % 3)) in
    0) TAGS='["mongodb","pagination"]' ;;
    1) TAGS='["mongodb","nestjs"]' ;;
    2) TAGS='["docker"]' ;;
  esac
  CREATED="$(call POST "$BASE/api/catalog/items" "$ALICE" -H 'Content-Type: application/json' \
    -d "{\"title\":\"Smoke test item $i\",\"body\":\"Text of smoke item number $i\",\"tags\":$TAGS}")"
  [ "$(status)" = "201" ] || fail "create item $i"
  ID="$(echo "$CREATED" | json '.id')"
  [ "$i" = "1" ] && FIRST_SLUG="$(echo "$CREATED" | json '.slug')"
  call POST "$BASE/api/catalog/items/$ID/publish" "$ALICE" > /dev/null
  [ "$(status)" = "200" ] || fail "publish item $i"
  ITEM_IDS+=("$ID")
done
ok "created and published ${#ITEM_IDS[@]} items"
FIRST_ID="${ITEM_IDS[0]}"

call PATCH "$BASE/api/catalog/items/$FIRST_ID" "$BOB" -H 'Content-Type: application/json' -d '{"title":"Stolen"}' > /dev/null
expect_status 403 "Bob cannot edit Alice's item"
call GET "$BASE/api/catalog/items/$FIRST_SLUG" "$BOB" > /dev/null
expect_status 200 "GET /api/catalog/items/:slug (adds a view)"

step "7. Likes: transaction and duplicate"
LIKED="$(call POST "$BASE/api/catalog/items/$FIRST_ID/like" "$BOB")"
expect_status 201 "Bob likes the item"
ok "likes = $(echo "$LIKED" | json '.likes')"
call POST "$BASE/api/catalog/items/$FIRST_ID/like" "$BOB" > /dev/null
expect_status 409 "a second like is refused and nothing changes"
call POST "$BASE/api/catalog/items/$FIRST_ID/like" "$CAROL" > /dev/null
expect_status 201 "Carol likes the item"

step "8. Filtering, sorting and offset pagination"
FILTERED="$(call GET "$BASE/api/catalog/items?tags=mongodb,nestjs&tagMode=all&sort=likes&order=desc&page=1&pageSize=3" "$ALICE")"
expect_status 200 "GET /api/catalog/items?tags=mongodb,nestjs&tagMode=all&sort=likes"
ok "offset page: $(echo "$FILTERED" | json '.items.length') items of $(echo "$FILTERED" | json '.total'), first has $(echo "$FILTERED" | json '.items[0].stats.likes') likes"
TEXT="$(call GET "$BASE/api/catalog/items?q=smoke&authorId=$ALICE_ID&dateFrom=2020-01-01T00:00:00Z" "$ALICE")"
expect_status 200 "GET /api/catalog/items?q=smoke&authorId=...&dateFrom=..."

step "9. Keyset (cursor) pagination, 5 per page"
CURSOR=""
SEEN=0
PAGES=0
while : ; do
  PAGE="$(call GET "$BASE/api/catalog/items?authorId=$ALICE_ID&q=smoke&sort=createdAt&order=desc&pageSize=5&cursor=$CURSOR" "$ALICE")"
  [ "$(status)" = "200" ] || fail "cursor page"
  COUNT="$(echo "$PAGE" | json '.items.length')"
  SEEN=$((SEEN + COUNT))
  PAGES=$((PAGES + 1))
  CURSOR="$(echo "$PAGE" | json '.nextCursor || ""')"
  [ -n "$CURSOR" ] || break
  [ "$PAGES" -lt 50 ] || fail "too many pages"
done
ok "walked $PAGES pages, saw $SEEN items"
[ "$SEEN" -ge 12 ] || fail "expected at least 12 items from the cursor walk"

step "10. Aggregations"
call GET "$BASE/api/catalog/stats/tags?limit=5" "$ALICE" > /dev/null
expect_status 200 "GET /api/catalog/stats/tags"
AUTHORS="$(call GET "$BASE/api/catalog/stats/authors?limit=3" "$ALICE")"
expect_status 200 "GET /api/catalog/stats/authors"
ok "authors with published items: $(echo "$AUTHORS" | json '.totals.authors')"

step "11. Collection built in one transaction"
COLLECTION="$(call POST "$BASE/api/catalog/collections" "$ALICE" -H 'Content-Type: application/json' -d '{"name":"Smoke reading list"}')"
expect_status 201 "POST /api/catalog/collections"
COLLECTION_ID="$(echo "$COLLECTION" | json '.id')"
IDS_JSON="[\"${ITEM_IDS[4]}\",\"${ITEM_IDS[1]}\",\"${ITEM_IDS[7]}\",\"${ITEM_IDS[1]}\"]"
call POST "$BASE/api/catalog/collections/$COLLECTION_ID/items" "$ALICE" -H 'Content-Type: application/json' -d "{\"itemIds\":$IDS_JSON}" > /dev/null
expect_status 200 "POST /api/catalog/collections/:id/items (a repeated id is ignored)"
DETAIL="$(call GET "$BASE/api/catalog/collections/$COLLECTION_ID" "$ALICE")"
expect_status 200 "GET /api/catalog/collections/:id"
ORDER="$(echo "$DETAIL" | json '.items.map((item) => item.title).join(" | ")')"
ok "items in stored order: $ORDER"
[ "$(echo "$DETAIL" | json '.items.length')" = "3" ] || fail "expected 3 items in the collection"
call GET "$BASE/api/catalog/collections/$COLLECTION_ID" "$BOB" > /dev/null
expect_status 404 "Bob cannot see Alice's collection"

step "12. Logout"
BOB_REFRESH="$(echo "$BOB_LOGIN" | json '.refreshToken')"
call POST "$BASE/api/auth/logout" "" -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$BOB_REFRESH\"}" > /dev/null
expect_status 204 "POST /api/auth/logout"
call POST "$BASE/api/auth/refresh" "" -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$BOB_REFRESH\"}" > /dev/null
expect_status 401 "the logged out refresh token no longer works"

printf '\n\033[1;32mSmoke test passed.\033[0m\n'
