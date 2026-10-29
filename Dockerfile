# One Dockerfile for every service. Pick the service with the build arg APP:
#   docker build --build-arg APP=auth-service -t contenthub-auth .
# APP is the folder name under apps/ or tools/ (auth-service, profile-service, catalog-service, mock-oauth).

ARG NODE_IMAGE=node:22-alpine

# ---- build: install all dependencies, compile the shared library and the chosen app ----
FROM ${NODE_IMAGE} AS build
ARG APP
WORKDIR /repo

# Copy only the package files first, so the npm ci layer is cached until dependencies change.
COPY package.json package-lock.json tsconfig.base.json ./
COPY libs/common/package.json libs/common/
COPY tools/mock-oauth/package.json tools/mock-oauth/
COPY apps/auth-service/package.json apps/auth-service/
COPY apps/profile-service/package.json apps/profile-service/
COPY apps/catalog-service/package.json apps/catalog-service/
RUN npm ci

COPY libs libs
COPY apps apps
COPY tools tools
RUN npm run build -w @contenthub/common && npm run build -w @contenthub/${APP}
RUN npm prune --omit=dev

# ---- runtime: production dependencies and compiled code only ----
FROM ${NODE_IMAGE} AS runtime
ARG APP
ENV NODE_ENV=production \
    APP_NAME=${APP} \
    AVATAR_DIR=/data/avatars
WORKDIR /repo

COPY --from=build /repo/package.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/libs ./libs
COPY --from=build /repo/apps ./apps
COPY --from=build /repo/tools ./tools

# The avatar volume is mounted here. Create it with the right owner so the non-root user can write.
RUN mkdir -p /data/avatars && chown -R node:node /data
USER node

CMD ["sh", "-c", "cd $(ls -d apps/$APP_NAME tools/$APP_NAME 2>/dev/null | head -1) && exec node dist/main.js"]
