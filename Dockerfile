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

COPY --from=build /app/dist/SmartComanda_pos/browser /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Runtime configuration: env.js is generated from the container environment at start
COPY docker/env.template.js /etc/nginx/env.template.js
COPY docker/40-runtime-env.sh /docker-entrypoint.d/40-runtime-env.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-env.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
