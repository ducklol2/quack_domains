const { request } = require('http');
const { spawn } = require('child_process');
const { networkInterfaces } = require('os');

const TRAEFIK_RULE_REGEX = /traefik.http.routers.(\w+).rule/;
const TRAEFIK_HOST_REGEX = /Host\(`([\w\.]+\.local)`\)/;
const REQUEST_OPTIONS = {
  socketPath: '/run/docker.sock',
  path: 'http://localhost/containers/json',
};

main();

async function main() {
  const hostIp = getIp();
  if (!hostIp) {
    console.log('No potential IPs found :( (TODO: Allow user to set one)');
    return;
  }

  const newContainerHosts = await getHostsAndPublish(hostIp);
}

// Guesses the local host machine's local IP.
function getIp() {
  const ips = [];
  for (const [interface, networks] of Object.entries(networkInterfaces())) {
    for (const network of networks) {
      // Skip internal networks.
      if (network.internal) continue;

      // Skip IPv6 networks. (TODO: Support & test them)
      if (network.family != 'IPv4' && network.family != 4) continue;

      // Skip "br-..." networks, they're probably Docker bridge networks?
      if (interface.startsWith('br-')) continue;

      console.log(`Found interface ${interface} with ipv4 ${network.address}, family ${network.family}`);

      ips.push(network.address);
    }
  }

  if (!ips.length) return null;

  console.log(`Using the first address found, ${ips[0]}.`);
  return ips[0];
}

// Finds Traefik router labels with matching Host() rules.
async function getHostsAndPublish(hostIp) {
  const containers = await getDockerContainers();

  const containerHosts = {};
  for (const container of containers) {
    const containerName = container['Names'][0];
    containerHosts[containerName] = [];

    for (const [label, labelValue] of Object.entries(container['Labels'])) {
      const labelMatch = TRAEFIK_RULE_REGEX.exec(label);
      if (!labelMatch) continue;

      for (const rule of labelValue.split('||')) {
        const valueMatch = TRAEFIK_HOST_REGEX.exec(rule);
        if (!valueMatch) continue;
        
        const host = valueMatch[1];
        containerHosts[containerName][host] = publish(host, hostIp);
      }
    }
  }

  return containerHosts;
}

// Lists all Docker containers from the Docker socket.
async function getDockerContainers() {
  return new Promise((resolve, reject) => {
    request(REQUEST_OPTIONS, response => {
      response.setEncoding('utf8');
      response.on('data', data => resolve(JSON.parse(data)));
      response.on('error', error => reject(error));
    }).end();
  });
}

// Runs avahi-publish-address.
function publish(host, ip) {
  console.log(`Running avahi-publish-address for host ${host} pointing to IP ${ip}`);

  const process = spawn('avahi-publish-address', ['-R', host, ip]);
  process.stdout.on('data', data => console.log(`Avahi stdout: ${data.toString().trim()}`));
  process.stderr.on('data', data => console.log(`Avahi stderr: ${data.toString().trim()}`));
  process.on('error', err => console.error('Avahi err:', err));
  process.on('close', code => console.log('Avahi close:', code));

  return process;
}
