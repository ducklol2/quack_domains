console.log('hi');

const { request } = require('http');
const { spawn } = require("child_process");

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
            publish(valueMatch[1], '192.168.1.123');
          }
        }
      }
    }
  }
}



// echo "Adding hostname ${split_host[0]} pointing at IP ${split_host[1]}"
// avahi-publish-address -R ${split_host[0]} ${split_host[1]} &

function publish(host, ip) {
  console.log(`Running avahi-publish-address for host ${host} pointing to IP ${ip}`);
  const avahi = spawn('avahi-publish-address', ['-R', host, ip]);

  avahi.stdout.on("data", data => console.log(`avahi stdout: ${data}`));
  avahi.stderr.on("data", data => console.log(`avahi stderr: ${data}`));
  avahi.on('error', err => console.log('avahi err: ', err));
  avahi.on('close', code => console.log('avahi close: ', code));
}

// const ls = spawn("ls", ["-la"]);

// ls.stdout.on("data", data => {
//     console.log(`stdout: ${data}`);
// });

// ls.stderr.on("data", data => {
//     console.log(`stderr: ${data}`);
// });

// ls.on('error', (error) => {
//     console.log(`error: ${error.message}`);
// });

// ls.on("close", code => {
//     console.log(`child process exited with code ${code}`);
// });
