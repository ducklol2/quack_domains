const { request } = require('http');
const { spawn } = require('child_process');
const { networkInterfaces } = require('os');

// Format:
// traefik.http.routers.my_example_server.rule=Host(`example.local`) || Host(`subdomain.example.local`) || Method(`GET`)
const TRAEFIK_RULE_REGEX = /traefik.http.routers.(\w+).rule/;
const TRAEFIK_HOST_REGEX = /Host\(`([-\w\.]+\.local)`\)/g;

// Simpler label for people who don't use Traefik. Format:
// quack_domains.hosts=another_example.local || subdomain.another_example.local
const QUACK_RULE_REGEX = /quack_domains.hosts/;
const QUACK_HOST_REGEX = /([-\w\.]+\.local)/g;

// Shoutout to this great list of quick Docker API curl testing commands:
// https://sleeplessbeastie.eu/2021/12/13/how-to-query-docker-socket-using-curl/

let DOCK_SOCK = '/var/run/docker.sock';
if (process.env.DOCKER_HOST) {
  // $DOCKER_HOST is set in Docker rootless mode.
  // https://docs.docker.com/engine/security/rootless/
  console.log('process.env.DOCKER_HOST:', typeof process.env.DOCKER_HOST);
  DOCK_SOCK = process.env.DOCKER_HOST.replaceAll('unix://', '');
}

// https://docs.docker.com/engine/api/v1.43/#tag/Container/operation/ContainerList
const REQUEST_OPTIONS_LIST = {
  socketPath: DOCK_SOCK,
  path: 'http://localhost/containers/json',
};

// https://docs.docker.com/engine/api/v1.43/#tag/System/operation/SystemEvents
const REQUEST_OPTIONS_MONITOR = {
  socketPath: DOCK_SOCK,
  path: 'http://localhost/events',
};


const processes = {};  // Global variable with all our processes. Meh.

main();

async function main() {
  const hostIp = getIp();
  if (!hostIp) {
    console.log('No potential IPs found :( (TODO: Allow user to set one)');
    return;
  }

  publishCurrentHosts(hostIp);
  monitorDockerContainerEvents(hostIp);
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

// Finds _existing_ Traefik router labels with matching Host() rules.
// Run once at startup.
async function publishCurrentHosts(hostIp) {
  const containers = await listCurrentDockerContainers();

  for (const container of containers) {
    let containerName = container['Names'][0];
    if (containerName.startsWith('/')) containerName = containerName.substring(1);
    handleAttributes(hostIp, containerName, container['Labels']);
  }
}

// Lists all Docker containers from the Docker socket.
async function listCurrentDockerContainers() {
  return new Promise((resolve, reject) => {
    request(REQUEST_OPTIONS_LIST, response => {
      response.setEncoding('utf8');
      response.on('data', data => resolve(JSON.parse(data)));
      response.on('error', error => reject(error));
    }).end();
  });
}

// Monitors for Docker container events and publishes new hosts.
function monitorDockerContainerEvents(hostIp) {
  request(REQUEST_OPTIONS_MONITOR, response => {
    response.setEncoding('utf8');
    response.on('data', data => handleDockerEvent(hostIp, JSON.parse(data)));
    response.on('error', error => console.error('Docker socket error:', error));
  }).end(); // Never actually returns
}

// Handles an event from the Docker socket.
function handleDockerEvent(hostIp, data) {
  switch (data.Action) {
    case 'start':
      handleAttributes(hostIp, data.Actor.Attributes.name, data.Actor.Attributes);
      break;
    case 'stop':
      handleStopEvent(data.Actor.Attributes.name);
      break;
  }
}

// Reads through the attributes and starts any Avahi publish processes, if new.
function handleAttributes(hostIp, containerName, attributes) {
  for (const [label, labelValue] of Object.entries(attributes)) {
    const hosts = extractHosts(label, labelValue);
    if (!hosts) continue;

    for (const host of hosts) {
      if (!processes[containerName]) processes[containerName] = {};

      // Skip if it's already running.
      if (processes[containerName][host]) continue;

      console.log(`Container ${containerName} started. Host ${host}, IP ${hostIp}.`);
      processes[containerName][host] = publish(host, hostIp);
    }
  }
}

function extractHosts(label, labelValue) {
  if (label.match(TRAEFIK_RULE_REGEX)) {
    return [...labelValue.matchAll(TRAEFIK_HOST_REGEX)].map(match => match[1]);
  }

  if (label.match(QUACK_RULE_REGEX)) {
    return [...labelValue.matchAll(QUACK_HOST_REGEX)].map(match => match[1]);
  }

  return undefined;
}

// Stops all the processes for the container, if any.
function handleStopEvent(containerName) {
  if (!processes[containerName]) return;

  const killedHosts = [];
  for (const [host, process] of Object.entries(processes[containerName])) {
    killedHosts.push(host);
    process.kill('SIGKILL');
  }

  console.log(`Container ${containerName} stopped. Killing processes for ${killedHosts.join(', ')}.`);
  delete processes[containerName];
}

// Runs avahi-publish-address.
function publish(host, ip) {
  console.log(`$ avahi-publish-address -R ${host} ${ip}`);

  const process = spawn('avahi-publish-address', ['-R', host, ip]);
  process.stdout.on('data', data => console.log(`Avahi stdout: ${data.toString().trim()}`));
  process.stderr.on('data', data => console.log(`Avahi stderr: ${data.toString().trim()}`));
  process.on('error', err => console.error('Avahi err:', err));
  process.on('close', code => console.log(`Avahi stopped. Exit code: ${code || 'success'}`));

  return process;
}
