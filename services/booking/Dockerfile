FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

FROM node:18-alpine
WORKDIR /app
COPY --from=build /app .
EXPOSE 4000
CMD ["npm","start"]
