FROM alpine

RUN apk add --no-cache avahi-utils

COPY . /app

CMD ["/app/publish.sh"]
