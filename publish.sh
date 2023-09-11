#!/bin/bash

function _term {
  echo "Terminated; killing all avahi-publish-address instances."
  pkill -P $$
}

trap _term SIGTERM

if [ -z $HOSTS ]; then
	echo "HOSTS not defined. Example: HOSTS=192.168.1.123:xyz.local"
	echo "Hosts: $HOSTS"
	exit 1
fi

IFS=','
read -a split_hosts <<< "$HOSTS"
for host in "${split_hosts[@]}"; do
	IFS=':'
	read -a split_host <<< "$host"
	echo "Adding hostname ${split_host[0]} pointing at IP ${split_host[1]}"
	avahi-publish-address -R ${split_host[0]} ${split_host[1]} &
done

while true; do sleep 10000; done
