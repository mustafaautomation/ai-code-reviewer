FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
USER app
EXPOSE 3000
CMD ["node", "dist/server/app.js"]

# Usage:
#   docker build -t ai-reviewer .
#   docker run --rm -p 3000:3000 \
#     -e GITHUB_TOKEN=ghp_xxx \
#     -e ANTHROPIC_API_KEY=sk-ant-xxx \
#     ai-reviewer
