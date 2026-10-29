# ContentHub

ContentHub is a small backend for a consumer web product. It has user profiles with avatar upload, a large content catalog with filtering, sorting and two kinds of pagination, and login through a third-party OAuth2 provider.

It is built as three NestJS services on one MongoDB server. Each service has its own database. It is a portfolio project: the code is meant to be easy to read.

**Stack:** Node 22, TypeScript (strict), NestJS 11, MongoDB 7 with Mongoose 9 and the native driver, class-validator, Swagger, jest and supertest, npm workspaces, Docker Compose, nginx.

## What is inside

| Part | Port | Database | Job |
| --- | --- | --- | --- |
| `apps/auth-service` | 4001 | `contenthub_auth` | OAuth2 login with GitHub (or the mock), JWT access tokens, rotating refresh tokens, sessions |
| `apps/profile-service` | 4002 | `contenthub_profiles` | Profiles, preferences, avatar upload, public search |
| `apps/catalog-service` | 4003 | `contenthub_catalog` | Content items, likes, collections, statistics |
| `libs/common` | | | Config loading, JWT guard, error filter, pagination helpers, request ids |
| `tools/mock-oauth` | 9000 | | A tiny Express app that imitates GitHub's OAuth endpoints |
| `gateway` (nginx) | 8081 | | One entry point: `/api/auth`, `/api/profiles`, `/api/catalog` |

Every endpoint is listed in [ENDPOINTS.md](ENDPOINTS.md). Every service also has Swagger at `/docs` on its own port.

## Architecture

```
            browser / client
                  |
          nginx gateway :8081
        /         |          \
 auth-service  profile-service  catalog-service
    :4001         :4002            :4003
      |             |                |
 contenthub_auth  contenthub_profiles  contenthub_catalog      (one MongoDB replica set)
```

Rules:

- One service, one bounded context, one database. A service never reads another service's database.
- The services share only the signed JWT. auth-service signs it. The other two only check it.
- The JWT uses HS256 with a shared secret from the environment (`JWT_SECRET`). This is fine for a demo. In production use an asymmetric algorithm (RS256 or EdDSA), so only auth-service holds the private key and the other services hold the public key.

### Inside each service

```
src/
  domain/          aggregates, entities, value objects, domain errors, repository interfaces.
                   No framework imports.
  application/     use cases. One class per use case.
  infrastructure/  Mongoose schemas, repository implementations, adapters (GitHub client, disk storage).
  interfaces/http/ controllers, DTOs, mappers.
```

The dependency direction is always inward: `interfaces` and `infrastructure` know the `application` and `domain` layers. The domain knows nothing about them.

This is what you get from it: the use cases are tested with in-memory fake repositories. No database, no mocks of Mongoose. See `src/testing/` in each service.

What is deliberately not here: no CQRS bus, no event sourcing, no generic base classes, no type tricks. Plain classes and explicit types.

`DomainError` (in `libs/common`) is the one small class shared by all domains. It has no framework imports. The exception filter maps its `kind` to an HTTP status.

### Mongoose and the native driver

Both are used on purpose.

| Used for | Tool |
| --- | --- |
| CRUD, offset pagination, atomic `$inc`, upserts | Mongoose models (`find`, `findOneAndUpdate`, `updateOne`) |
| Keyset (cursor) pagination | `model.aggregate()` with a `$match`, `$sort`, `$limit` pipeline |
| `GET /stats/tags` and `GET /stats/authors` | Native driver: `connection.db.collection('items').aggregate()` with `$unwind`, `$group`, `$facet` |
| `GET /collections/:id` | `model.aggregate()` with `$lookup`, then `$map` to keep the stored order |
| Likes and collection updates | `connection.startSession()` and `session.withTransaction()` |

### Pagination

`GET /api/catalog/items` supports two modes.

- **Offset:** `?page=2&pageSize=20`. The answer has `total` and `totalPages`. Simple, but `skip` gets slower on deep pages.
- **Keyset (cursor):** `?cursor=<nextCursor>&pageSize=20`. Send `cursor=` (empty) for the first page. The answer has `nextCursor`, which is `null` on the last page. The cursor holds the last row's sort value and `_id`:

  ```
  sort by likes desc, last row: likes=3, _id=...a1
  next page:  likes < 3   OR   (likes = 3 AND _id < ...a1)
  ```

  The `_id` breaks ties, so no row is skipped or repeated, even when thousands of rows have the same value.

### Transactions

Transactions need a replica set, so Docker Compose starts MongoDB 7 as a single-node replica set (`rs0`).

- **Like:** insert the like document and `$inc` the item counter in one transaction. The unique index on `(itemId, userId)` makes a second like fail with a duplicate key error. The error becomes `409` and nothing changes.
- **Unlike:** delete the like and `$inc: -1` in one transaction.
- **Add items to a collection:** check the items, check the size cap and `$addToSet` all ids in one transaction. One bad id means nothing is added.
- **Delete an item:** delete the item and its likes in one transaction.

## Run with Docker Compose

You need Docker. Nothing else, and no secrets.

```bash
docker compose up --build
```

Wait until all containers are healthy. Then:

| What | URL |
| --- | --- |
| Gateway (use this) | http://localhost:8081 |
| Mock OAuth provider | http://localhost:9000 |
| Swagger | http://localhost:4001/docs, http://localhost:4002/docs, http://localhost:4003/docs |
| MongoDB | `mongodb://localhost:27017/?directConnection=true` |

Then try it:

```bash
npm install           # only needed for the seed script
npm run seed          # 3 users with profiles, 40 items, likes, 2 collections
./scripts/smoke.sh    # a curl walkthrough of the whole system
```

You can also open `requests.http` in VS Code (REST Client extension) and run the requests one by one.

The seeded users are `alice`, `bob` and `carol`. They match the mock provider, so logging in as one of them gives you the seeded data.

### Use real GitHub instead of the mock

1. Create a GitHub OAuth app. Set the callback URL to `http://localhost:8081/api/auth/github/callback`.
2. Put `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env` (copy `.env.example`).
3. Start with the extra file:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.github.yml up --build
   ```

## Run locally (without Docker for the services)

You need Node 22 and a MongoDB replica set. The easiest way to get one is the compose file:

```bash
cp .env.example .env
docker compose up -d --wait mongo     # MongoDB 7 replica set on localhost:27017
npm install
npm run build

# in separate terminals (or add & at the end)
npm run start:mock-oauth      # :9000
npm run start:auth            # :4001
npm run start:profile         # :4002
npm run start:catalog         # :4003

npm run seed                  # optional demo data
```

Without the gateway, call the services directly: `http://localhost:4001/api/auth/...`, `4002` for profiles, `4003` for the catalog. `GITHUB_REDIRECT_URI` in `.env.example` already points to port 4001.

To log in from a terminal: open `http://localhost:4001/api/auth/github/login` in a browser. The mock provider approves at once and the callback shows the tokens as JSON.

## Environment variables

All services read the process environment. For local runs, `npm run start:*` loads `.env` with `node --env-file`. In Docker Compose the values are set in `docker-compose.yml`.

| Variable | Used by | Default | Meaning |
| --- | --- | --- | --- |
| `JWT_SECRET` | all three | none (required) | HS256 secret, at least 32 characters |
| `MONGO_URI` | all three | `mongodb://localhost:27017/?replicaSet=rs0` | Connection string. In Docker: `mongodb://mongo:27017/?replicaSet=rs0` |
| `MONGO_DB_NAME` | all three | per service (see table above) | Database name |
| `PORT` | all three | 4001 / 4002 / 4003 | HTTP port |
| `GITHUB_CLIENT_ID` | auth | none (required) | OAuth client id |
| `GITHUB_CLIENT_SECRET` | auth | none (required) | OAuth client secret |
| `GITHUB_AUTHORIZE_URL` | auth | GitHub | Where the browser is sent. Must be reachable from the browser |
| `GITHUB_TOKEN_URL` | auth | GitHub | Where the service exchanges the code |
| `GITHUB_API_URL` | auth | `https://api.github.com` | Base URL for `/user` and `/user/emails` |
| `GITHUB_REDIRECT_URI` | auth | `http://localhost:8081/api/auth/github/callback` | Callback URL sent to the provider |
| `ACCESS_TOKEN_TTL_SECONDS` | auth | 900 | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | auth | 30 | Refresh token lifetime |
| `COOKIE_SECURE` | auth | false | Set to true behind HTTPS |
| `AVATAR_DIR` | profile | `./data/avatars` | Where avatar files are stored. A Docker volume in Compose |
| `MOCK_OAUTH_PORT` | mock-oauth | 9000 | Port of the mock |

The three URLs are separate because in Docker the browser reaches the mock at `localhost:9000` while the service reaches it at `mock-oauth:9000`.

## Auth flow

This is the OAuth2 authorization code flow. The services use `Authorization: Bearer` tokens, not cookies. The only cookie is a short-lived `oauth_state` cookie that protects the login redirect.

```
1  client   GET /api/auth/github/login
2  service  302 to the provider /authorize?client_id&redirect_uri&scope&state=<random>
            Set-Cookie: oauth_state=<random>; HttpOnly; SameSite=Lax; Max-Age=600
3  provider (user logs in and approves) 302 to /api/auth/github/callback?code&state
4  client   GET /api/auth/github/callback?code&state   (cookie is sent by the browser)
5  service  state in query == state in cookie?  no: 401
6  service  POST provider /access_token     -> provider access token
7  service  GET  provider /user and /user/emails
8  service  upsert user (findOneAndUpdate, upsert, keyed by provider id)
9  service  200 { accessToken, refreshToken, user }
```

- **Access token:** a JWT (HS256), valid 15 minutes. Claims: `sub` (user id), `login`, `name`, `email`, `sid` (session id).
- **Refresh token:** a random opaque string. Only its SHA-256 hash is stored.
- **Rotation:** `POST /api/auth/refresh` returns a new access token and a new refresh token. The old refresh token is spent.
- **Reuse detection:** if a spent refresh token is used again, we assume it was stolen. The whole session (the token family) is revoked, so the thief and the real user are both logged out.
- **Sessions:** `GET /api/auth/sessions` lists them. `DELETE /api/auth/sessions/:id` signs one out.
- **Provider calls:** `fetch` with a 5 second timeout and one retry on 5xx or network errors. A provider failure becomes `502`. A bad code becomes `401`.

## Errors and logging

Every error has the same JSON shape:

```json
{ "statusCode": 409, "error": "CONFLICT", "code": "HANDLE_TAKEN", "message": "...", "requestId": "...", "path": "...", "timestamp": "..." }
```

- A MongoDB duplicate key error (code 11000) that nobody handled becomes `409`.
- Unexpected errors become `500` with a generic message. The details go to the log only.
- Each request gets an `X-Request-Id` (the gateway sets it, or the service makes one). It is in the response header, the error body and the log line.

## Tests

```bash
npm test             # unit tests, no database needed
npm run typecheck    # type-check every file, including tests
```

The unit tests cover:

- domain logic (items, collections, handles, refresh tokens, image signatures, cursors, query builders)
- every use case, with in-memory fake repositories
- the HTTP layer of each service with real controllers, guards, pipes, multer and the error filter, over fake repositories
- the full OAuth flow through HTTP against the real mock-oauth server
- the real `AppModule` of each service, with only the MongoDB connection stubbed

### End-to-end tests (need MongoDB)

These tests run the real services against a real MongoDB replica set. They check what fakes cannot: indexes, text search, transactions, `$lookup`, atomic counters, parallel requests.

```bash
docker compose up -d --wait mongo
npm run test:e2e
```

By default they use `mongodb://localhost:27017/?directConnection=true`. Set `MONGO_URI` to use another server. Each test file creates its own database (`e2e_<service>_<random>`) and drops it at the end.

## Notes and limits

- NestJS 11 is used, not 12. NestJS 12 is published as ESM only, and this project is CommonJS with jest. The 11.x packages work together as pinned in `package.json`.
- The MongoDB indexes are created by Mongoose at startup (`model.init()`). In a bigger system you would run migrations instead.
- Avatars are stored on local disk, in a Docker volume. For several instances you would use object storage. The `AvatarStorage` interface is the place to change.
- The mock provider approves everything. Never expose it.
- There is no rate limiting and no refresh token cookie flow. This is a backend demo.
