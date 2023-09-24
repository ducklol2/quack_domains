# subdomains

```
git clone git@github.com:ducklol2/subdomains.git
cd subdomains
cp .env.example .env
nano .env
sudo docker compose up --build -d
```

Add your domains:IPs. They need to end in `.local`.

## Testing

Run the Traefik example in the background with:

```
docker compose -f traefik_example.yaml up -d
```

### On GitHub Codespaces

To get Avahi running:

```
sudo apt update
sudo apt install avahi-daemon avahi-utils
sudo service dbus start
sudo avahi-daemon -D
```