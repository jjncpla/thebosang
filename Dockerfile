FROM node:22-bookworm-slim

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
