# Dev image: runs the Vite dev server with HMR against a source volume mount.
# Production would build static assets (`vite build`) and serve them from a
# CDN/static host — not needed until the Deploy milestone.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/frontend/package.json packages/frontend/package.json

RUN npm install

COPY packages/frontend packages/frontend

WORKDIR /app/packages/frontend

EXPOSE 5173

CMD ["npm", "run", "dev"]
