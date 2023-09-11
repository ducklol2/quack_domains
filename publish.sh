#!/bin/bash

function _term {
  pkill -P $$
}

trap _term SIGTERM

#avahi-daemon &

avahi-publish-address -R jfin.macmini.local 192.168.86.27 &

echo 'Publishing.'

while true; do sleep 10000; done
