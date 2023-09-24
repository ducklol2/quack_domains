console.log('hi');

const { request } = require('http');
const { spawn } = require("child_process");
const { networkInterfaces } = require('os');

const ip = getIp();
console.log(`Using IP: ${ip}`);
function getIp() {
  let ip;
  for (const [interface, networks] of Object.entries(networkInterfaces())) {
    for (const network of networks) {
      if (network.internal) continue;
      if (network.family != 'IPv4') continue;  // may be 4 in some node versions?
      console.log(`found interface ${interface} with ipv4 ${network.address}, family ${network.family}`);
      if (!ip) ip = network.address;  // just use first one, but list 'em all
    }
  }
  return ip;
}

const options = {
  socketPath: '/run/docker.sock',
  path: 'http://localhost/containers/json',
};

const callback = res => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', data => handleContainers(JSON.parse(data)));
  res.on('error', data => console.error(data));
};

const clientRequest = request(options, callback);
clientRequest.end();

const traefikRuleRegex = /traefik.http.routers.(\w+).rule/;
const traefikHostRegex = /Host\(`([\w\.]+)`\)/;
function handleContainers(containers) {
  for (const container of containers) {
    console.log(`container id ${container['Id']}`);

    for (const [label, value] of Object.entries(container['Labels'])) {
      const labelMatch = traefikRuleRegex.exec(label);
      if (labelMatch) {
        const rules = value.split('||');
        for (const rule of rules) {
          const valueMatch = traefikHostRegex.exec(rule);
          if (valueMatch) {
            console.log(`container router host: ${valueMatch[1]}`);
            publish(valueMatch[1], ip);
          }
        }
      }
    }
  }
}

function publish(host, ip) {
  console.log(`Running avahi-publish-address for host ${host} pointing to IP ${ip}`);
  const avahi = spawn('avahi-publish-address', ['-R', host, ip]);

  avahi.stdout.on("data", data => console.log(`avahi stdout: ${data}`));
  avahi.stderr.on("data", data => console.log(`avahi stderr: ${data}`));
  avahi.on('error', err => console.log('avahi err: ', err));
  avahi.on('close', code => console.log('avahi close: ', code));
}
