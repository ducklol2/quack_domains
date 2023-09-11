FROM alpine

RUN apk add --no-cache avahi-tools

COPY . .

RUN chmod +x publish.sh

ENTRYPOINT ["/bin/sh", "publish.sh"]
