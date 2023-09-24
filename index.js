console.log('hi');

const http = require('http');

const options = {
  socketPath: '/run/docker.sock',
  path: 'http://localhost/version',
};

const callback = res => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', data => console.log(data));
  res.on('error', data => console.error(data));
};

const clientRequest = http.request(options, callback);
clientRequest.end();