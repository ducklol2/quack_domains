FROM node:alpine

RUN apk add --no-cache avahi-tools

COPY . .

ENTRYPOINT ["node", "index.js"]
