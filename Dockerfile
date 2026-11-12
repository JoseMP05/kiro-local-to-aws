# Imagen de producción del juego de tanques. Un único proceso Node con el
# estado de la partida en memoria: ejecutar UNA sola réplica.
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=3000

# Dependencias primero para aprovechar la caché de capas.
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

COPY config.json ./
COPY src ./src

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server/main.js"]
