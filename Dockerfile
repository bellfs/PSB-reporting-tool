FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN mkdir -p data/pdfs
EXPOSE 3000
CMD ["node", "server/index.js"]
