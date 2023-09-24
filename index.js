console.log('hi');

const http = require('http');

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

const clientRequest = http.request(options, callback);
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
          }
        }
      }
    }
  }
}