FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache bubblewrap
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run lint && npm run test && npm run smoke && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV FORGEX_SANDBOX_MODE=bwrap
ENV FORGEX_SANDBOX_REQUIRED=true
ENV FORGEX_WORKSPACE_ROOT=/workspace
RUN apk add --no-cache bubblewrap
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/server ./server
COPY --from=build /app/data ./data
COPY --from=build /app/metadata.json ./metadata.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY . /workspace
COPY --from=build /app/node_modules /workspace/node_modules
COPY --from=build /app/vite.config.ts ./vite.config.ts
RUN chown -R node:node /app/data /workspace
EXPOSE 3000
USER node
CMD ["node_modules/.bin/tsx", "server.ts"]
