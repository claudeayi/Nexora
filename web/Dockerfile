FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY index.html ./index.html
COPY src ./src
COPY vite.config.js ./vite.config.js
EXPOSE 5173
CMD ["npm","run","dev"]
