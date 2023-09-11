#!/bin/bash

avahi-publish-address -R jfin.macmini.local 192.168.86.27 &

while true; do sleep 10000; done
