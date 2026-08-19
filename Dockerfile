# =========================================
# Development (live reload)
# =========================================
FROM node:22-alpine AS dev

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]

# =========================================
# Build Angular
# =========================================
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# =========================================
# Nginx
# =========================================
FROM nginx:alpine

COPY --from=build /app/dist/frontend-pos/browser /usr/share/nginx/html

EXPOSE 80