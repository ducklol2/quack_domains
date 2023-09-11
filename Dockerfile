FROM alpine

RUN apk add --no-cache bash avahi-tools

COPY . .

RUN chmod +x publish.sh

ENTRYPOINT ["/bin/bash", "publish.sh"]
