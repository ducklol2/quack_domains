const { request } = require('http');
const { spawn } = require('child_process');
const { networkInterfaces } = require('os');

const TRAEFIK_RULE_REGEX = /traefik.http.routers.(\w+).rule/;
const TRAEFIK_HOST_REGEX = /Host\(`([\w\.]+\.local)`\)/;

// Shoutout to this great list of quick Docker API curl testing commands:
// https://sleeplessbeastie.eu/2021/12/13/how-to-query-docker-socket-using-curl/

// https://docs.docker.com/engine/api/v1.43/#tag/Container/operation/ContainerList
const REQUEST_OPTIONS_LIST = {
  socketPath: '/run/docker.sock',
  path: 'http://localhost/containers/json',
};

// https://docs.docker.com/engine/api/v1.43/#tag/System/operation/SystemEvents
const REQUEST_OPTIONS_MONITOR = {
  socketPath: '/run/docker.sock',
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
    const labelMatch = TRAEFIK_RULE_REGEX.exec(label);
    if (!labelMatch) continue;

    for (const rule of labelValue.split('||')) {
      const valueMatch = TRAEFIK_HOST_REGEX.exec(rule);
      if (!valueMatch) continue;

      const host = valueMatch[1];
      if (!processes[containerName]) {
        processes[containerName] = {};
      }
      if (!processes[containerName][host]) {
        console.log(`Container ${containerName} started. Host ${host}, IP ${hostIp}.`);
        processes[containerName][host] = publish(host, hostIp);
      }
    }
  }
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
