FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .

RUN mkdir -p /app/data /app/logs /app/temp

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
