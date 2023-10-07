# quack_domains

This tool looks for Docker compose labels like this:

```
labels:
  - traefik.http.routers.my_example_server.rule=Host(`example.local`)
```

And publishes the `.local` addresses on your local network, for other devices to access:

<img src="example_local_screenshot_desktop.png" height="150px"
alt="A desktop browser visiting the URL example.local">
<img src="example_local_screenshot_mobile.png" height="150px"
alt="A mobile browser visiting the URL example.local">

No client customization or DNS server needed!

__WARNING!__ This tool is very new and untested! You may need to dig into Node, Avahi, Traefik, and/or Docker if something doesn't work ;)

## Requirements

 - A Linux server, running:
   - Avahi
   - Docker containers via Docker compose, with labels like the above
     - Even if you don't use Traefik ([instructions](https://doc.traefik.io/traefik/user-guides/docker-compose/basic-example/)), this should work - you'll just need to add a label like above.
 - A client that supports mDNS, which is... virtually all of them. I've tested on Ubuntu, macOS, iOS, and ChromeOS.
    - Ubuntu quirk: out of the box, it ignores mDNS subdomains - `example.local` works, but `subdomain.example.local` does not. ([GitHub issue](https://github.com/ducklol2/quack_domains/issues/1))

## Instructions

### Step 0: Make sure Avahi is running

This tool currently relies on the _host_ server's Avahi daemon. It's sometimes installed & running out of the box, but just to make sure, run this on your host server:

```
sudo apt-get update && sudo apt-get install avahi-daemon && sleep 5 && sudo service dbus start && sleep 5 && sudo avahi-daemon -D
```

### Step 1: Clone repo

```
git clone https://github.com/ducklol2/quack_domains.git
cd quack_domains
```

### Step 2: Modify & start _your_ containers

Make sure your containers have Traefik router labels with ``Host(`something.local`)`` rules, like this:

```
labels:
  - traefik.http.routers.my_example_server.rule=Host(`example.local`)
```

__IMPORTANT__: This tool only looks for containers __once__, __when it starts__, so you'll need to start them _before_ this tool.

__TODO__: Look for containers continuously.

If you don't have your own containers to play with, use my example! Run this:

```
sudo docker compose -f compose_example.yaml up -d
```

### Step 3: Start quack_domains

After starting the containers

```
sudo docker compose up --build -d
```

### Step 4: Visit your domain!

If you used `compose_example.yaml` from step #2, visit http://example.local/!

## Details

### Inspiration

I love playing with containers just on my local network, and I _really_ like how Traefik allows configuration via `compose.yaml`, so I decided to combine the two.

### How it works

Run as a Docker container, this executes a NodeJS script at startup that lists all Docker containers, guesses what your local IPv4 address is, looks for Traefik HTTP router rules containing ``Host(`...`)``, and runs an instance of `avahi-publish-address` for each host pointing at the local IP. Note that it talks to the _host's_ `avahi-daemon`.

### Security

There's a few potential security issues currently:
 - `network_mode: host`
 - `privileged: true`
 - Access to Docker socket
 - Access to Avahi / DBus

It might be possible to improve this tool if we can use an Avahi daemon _inside_ the container and just forward the mDNS messages through the Docker network.

Usage of the Docker socket could be protected with [Tecnativa/docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy).
