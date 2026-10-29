# Endpoints

Through the gateway use `http://localhost:8081` plus the path. Each service also listens on its own port (auth 4001, profiles 4002, catalog 4003) and serves Swagger at `/docs`.

"Auth" means `Authorization: Bearer <access token>` is required. Without it the answer is `401`.

## auth-service (prefix `/api/auth`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/auth/github/login` | no | Redirects (302) to the provider authorize URL. Sets the short-lived httpOnly `oauth_state` cookie |
| GET | `/api/auth/github/callback?code&state` | no | Checks `state` against the cookie, exchanges the code, upserts the user. Returns `{ accessToken, refreshToken, expiresIn, user }` |
| POST | `/api/auth/refresh` | no | Body `{ refreshToken }`. Rotates the refresh token. Reusing an old one revokes the session (401) |
| POST | `/api/auth/logout` | no | Body `{ refreshToken }`. Revokes that session. Always 204 |
| GET | `/api/auth/me` | yes | The current user |
| GET | `/api/auth/sessions` | yes | Active sessions of the current user. The one in use has `current: true` |
| DELETE | `/api/auth/sessions/:id` | yes | Signs one session out. 204, or 404 if it is not yours |
| GET | `/api/auth/providers` | no | Login providers that are configured |
| GET | `/api/auth/health` | no | Health check |

## profile-service (prefix `/api/profiles`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/profiles/me` | yes | My profile. Created from the token claims on first access |
| PUT | `/api/profiles/me` | yes | Replace `handle` (optional), `displayName`, `bio`, `location`, `links`. A taken handle gives 409 |
| PATCH | `/api/profiles/me/preferences` | yes | Change `theme`, `language`, `emailNotifications`, `publicProfile` |
| POST | `/api/profiles/me/avatar` | yes | Multipart field `avatar`. PNG, JPEG or WebP by magic bytes, max 2 MB (413 above, 415 for other content) |
| DELETE | `/api/profiles/me/avatar` | yes | Removes the avatar and its file |
| GET | `/api/profiles/:handle` | no | Public profile. 404 if it does not exist or `publicProfile` is false |
| GET | `/api/profiles?q&page&pageSize` | no | Search public profiles with the text index. Without `q`, newest first |
| GET | `/api/profiles/uploads/avatars/:file` | no | Avatar file |
| GET | `/api/profiles/health` | no | Health check |

## catalog-service (prefix `/api/catalog`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/catalog/items` | yes | Create an item. It starts as a `draft` |
| GET | `/api/catalog/items` | yes | List items. Filters: `q`, `tags` (comma separated), `tagMode=any\|all`, `authorId`, `status` (default `published`), `dateFrom`, `dateTo`. Sort: `sort=createdAt\|likes\|title`, `order=asc\|desc`. Pagination: offset (`page`, `pageSize`) or keyset (`cursor`, `pageSize`) |
| GET | `/api/catalog/items/:slug` | yes | One item by slug. Adds a view atomically with `$inc` |
| PATCH | `/api/catalog/items/:id` | yes, owner | Edit `title`, `body`, `tags`, or set `status: "archived"` |
| DELETE | `/api/catalog/items/:id` | yes, owner | Deletes the item and its likes in one transaction. 204 |
| POST | `/api/catalog/items/:id/publish` | yes, owner | `draft` to `published` |
| POST | `/api/catalog/items/:id/like` | yes | Like in a transaction. A second like gives 409 and changes nothing |
| DELETE | `/api/catalog/items/:id/like` | yes | Remove my like in a transaction. 404 if there is none |
| GET | `/api/catalog/stats/tags?limit` | yes | Most used tags. Aggregation: `$unwind`, `$group`, `$sort`, `$limit` |
| GET | `/api/catalog/stats/authors?limit` | yes | Top authors and totals. Aggregation: `$group` and `$facet` |
| POST | `/api/catalog/collections` | yes | Create a collection `{ name }` |
| GET | `/api/catalog/collections?page&pageSize` | yes | My collections |
| POST | `/api/catalog/collections/:id/items` | yes, owner | Body `{ itemIds }`, 1 to 50 ids. One transaction, `$addToSet`, cap of 200 items per collection |
| GET | `/api/catalog/collections/:id` | yes, owner | The collection with its items in the stored order (`$lookup`) |
| GET | `/api/catalog/health` | no | Health check |

### Item list answers

Offset mode:

```json
{ "mode": "offset", "items": [], "page": 1, "pageSize": 20, "total": 40, "totalPages": 2 }
```

Cursor mode (`nextCursor` is `null` on the last page):

```json
{ "mode": "cursor", "items": [], "pageSize": 20, "nextCursor": "eyJ2YWx1ZSI6..." }
```

Cursor mode is chosen when `cursor` is present (it may be empty for the first page) or when `pagination=cursor`.

## Number of endpoints

| Service | Business endpoints | With health |
| --- | --- | --- |
| auth-service | 8 | 9 |
| profile-service | 8 | 9 |
| catalog-service | 14 | 15 |
