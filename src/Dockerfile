FROM --platform=$BUILDPLATFORM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Default to production, but allow CI to override it for staging
ARG BUILD_CONFIGURATION=production
RUN npm run build -- --configuration $BUILD_CONFIGURATION

FROM nginx:alpine
COPY --from=build /app/dist/almonium-fe/browser/ /usr/share/nginx/html/
