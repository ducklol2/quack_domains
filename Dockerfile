FROM alpine

RUN apk add --no-cache bash avahi-tools curl jq

COPY . .

RUN chmod +x publish.sh

ENTRYPOINT ["/bin/bash", "publish.sh"]
