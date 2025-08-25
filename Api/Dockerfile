FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY prisma ./prisma
COPY src ./src
EXPOSE 4000
CMD npx prisma generate && node src/index.js
