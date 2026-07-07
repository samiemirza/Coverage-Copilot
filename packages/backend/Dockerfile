# Dev image: hot-reloads via tsx watch against a source volume mount.
# Production would build a slim, multi-stage image (compile with tsc, copy
# only dist/ + prod node_modules into a distroless/alpine runtime stage) —
# not yet needed until the Deploy milestone.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/backend/package.json packages/backend/package.json

RUN npm install

COPY packages/shared packages/shared
COPY packages/backend packages/backend

WORKDIR /app/packages/backend

EXPOSE 4000

CMD ["npm", "run", "dev"]
