# ---------- Build ----------
FROM node:22-alpine AS build
RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git python3 > /dev/null 2>&1
ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /opt/app
COPY package.json package-lock.json ./
# --ignore-scripts : évite le "postinstall: strapi build" avant la copie des sources
RUN npm ci --ignore-scripts --include=dev && npm rebuild better-sqlite3 sharp
COPY . .
RUN npm run build && npm prune --omit=dev

# ---------- Runtime ----------
FROM node:22-alpine
RUN apk add --no-cache vips
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1337
WORKDIR /opt/app
COPY --from=build --chown=node:node /opt/app ./
RUN mkdir -p public/uploads .tmp && chown -R node:node public/uploads .tmp
USER node
EXPOSE 1337
CMD ["npm", "run", "start"]
