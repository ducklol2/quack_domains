# quack_domains

## Automatically publish `.local` addresses from Docker Compose labels

This tool looks for Docker compose labels like this:

```
labels:
  - traefik.http.routers.my_example_server.rule=Host(`example.local`)
```

Or this, if not using Traefik:

```
labels:
  - quack_domains.hosts=example.local
```

And publishes the `.local` addresses on your local network, for other devices to access:

<img src="example_local_screenshot_desktop.png" height="150px"
alt="A desktop browser visiting the URL example.local">
<img src="example_local_screenshot_mobile.png" height="150px"
alt="A mobile browser visiting the URL example.local">

No client customization or DNS server needed!

__WARNING!__ This tool is very new and untested! You may need to dig into Node, Avahi, and/or Docker if something doesn't work ;)

## Requirements

 - A Linux server, running:
   - Avahi
   - Docker containers via Docker compose, with labels like one of those above
 - A client that supports mDNS, which is... virtually all of them. I've tested on Ubuntu, macOS, iOS, and ChromeOS.
    - Ubuntu quirk: out of the box, it ignores mDNS subdomains - `example.local` works, but `subdomain.example.local` does not. ([GitHub issue](https://github.com/ducklol2/quack_domains/issues/1))

## Instructions

### Step 0: Make sure Avahi is running

This tool currently relies on the _host's_ Avahi daemon. It's sometimes installed & running out of the box, but just to make sure, run this on your host server:

```
sudo apt-get update && sudo apt-get install avahi-daemon && sleep 5 && sudo service dbus start && sleep 5 && sudo avahi-daemon -D
```

### Step 1: Clone repo

```
git clone https://github.com/ducklol2/quack_domains.git
cd quack_domains
```

### Step 2: Start quack_domains

```
sudo docker compose up --build -d
```

It will monitor for Docker `start`/`stop` events.

### Step 3: Modify & start _your_ containers

They'll need either Traefik labels:

```
labels:
  - traefik.http.routers.my_example_server.rule=Host(`example.local`)
```

Or, if you don't use Traefik and don't want to write all that, it now supports:

```
labels:
  - quack_domains.hosts=example.local || subdomain.example.local
```

If you don't have your own containers to play with, use my example! Run this:

```
sudo docker compose -f compose_example.yaml up -d
```

Or see `compose_example_without_traefik.yaml` for an example without Traefik.

### Step 4: Visit your domain!

Visit the label you set. If you used `compose_example.yaml` from step #2, visit http://example.local/!

## Details

### Inspiration

I love playing with containers just on my local network, and I _really_ like how Traefik allows configuration via `compose.yaml`, so I decided to combine the two.

### Prior Art

I swear that I looked around for something like this prior to building it myself, and somehow I didn't find anything - but turns out many others have built something similar. Check them out too, see what makes sense to you! I'll note that I think mine is simpler (only Node & Avahi as dependencies).

 - https://gitlab.com/viraptor/docker_mdns: Written in Crystal, runs as a systemd service
 - https://github.com/hardillb/traefik-avahi-helper: Written in JS & Python, runs as a container, also monitors for changes

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

### Development

I've spent some time to get this working on GitHub Codespaces. Well, sort of - of course the actual mDNS addresses don't work on the hosted VPS! But, Avahi runs without complaint, given the right `postStartCommand` to set it up, in ``.devcontainer/devcontainer.json`, so you can mostly see whether its working.

Instead of building the container each time, I just run the script directly:

```
node index.js
```

And then, in a separate terminal, I start / stop / modify & re-up the included example and watch the logs:

```
sudo docker compose -f compose_example.yaml up -d
sudo docker compose -f compose_example.yaml down
```
