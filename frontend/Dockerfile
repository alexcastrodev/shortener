FROM node:22-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci --legacy-peer-deps

FROM node:22-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
COPY ./packages /app/packages
WORKDIR /app
RUN npm ci --omit=dev --legacy-peer-deps

FROM node:22-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
# Node resolves "localhost" to ::1 first in this base image, but the
# react-router v8 prerender preview server binds IPv4, so the prerender
# fetch gets ECONNREFUSED. Force IPv4 resolution to match the binding.
# https://github.com/remix-run/react-router/issues/15255
ENV NODE_OPTIONS=--dns-result-order=ipv4first
RUN npm run build

FROM node:22-alpine
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
CMD ["npm", "run", "start"]
