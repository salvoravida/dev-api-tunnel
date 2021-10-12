/* eslint-disable @typescript-eslint/no-var-requires */
import httpProxy from 'http-proxy';
const http = require('http');
//const httpProxy = require('http-proxy');
const version = require('../package.json').version;

const configFile = require(process.cwd() + '/.localhostify.js');

const env = process.argv[2];
if (!env || !configFile[env]) throw new Error(`Enviroment ${env} not found!`);

const config = configFile[env];
if (!config.target || !config.target.host) throw new Error('No target!');

/*** default configs ***/

config.allowHeaders = config.allowHeaders || 'content-type';

config.target = {
  changeOrigin: true,
  autoRewrite: true,
  protocolRewrite: 'http',
  ...config.target,
};

config.local = {
  changeOrigin: true,
  autoRewrite: true,
  host: 'http://localhost:3000',
  ...config.local,
};

/*** create reverse proxies  ***/

const proxy = httpProxy.createProxyServer({
  changeOrigin: config.target.changeOrigin,
  autoRewrite: config.target.autoRewrite,
  protocolRewrite: config.target.protocolRewrite,
  target: config.target.host,
});

const feproxy = httpProxy.createProxyServer({
  changeOrigin: config.local.changeOrigin,
  autoRewrite: config.local.autoRewrite,
  target: config.local.host,
});

/*** override Cookie, Origin and Refer to target ***/

proxy.on('proxyReq', (proxyReq, req) => {
  if (config.target.cookie) proxyReq.setHeader('Cookie', config.target.cookie);
  proxyReq.setHeader('origin', config.target.host);

  const referer = req.headers.referer;
  const origin = req.headers.origin;
  if (referer && origin) {
    proxyReq.setHeader('referer', referer.replace(origin, config.target.host));
  }
});

/*** ignore errors ***/

proxy.on('error', (w) => {
  console.log(w);
});

feproxy.on('error', (w) => {
  console.log(w);
});

const server = http.createServer((req, res) => {
  if (req.method !== 'OPTIONS') {
    if (new RegExp(config.target.matchUrl).test(req.url)) {
      console.log(req.method, config.target.host, req.url);
      proxy.web(req, res);
    } else {
      console.log(req.method, config.local.host, req.url);
      feproxy.web(req, res);
    }
  } else {
    /* set Options headers for cors fetch option*/
    res.setHeader('Access-Control-Allow-Headers', config.allowHeaders);
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, HEAD');
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.end();
  }
});

/*** hot reload ws ***/

server.on('upgrade', function (req, socket, head) {
  if (new RegExp(config.target.matchUrl).test(req.url)) {
    console.log('WS', config.target.host, req.url);
    proxy.ws(req, socket, head);
  } else {
    console.log('WS', config.local.host, req.url);
    feproxy.ws(req, socket, head);
  }
});

const port = Number(config.port || 3001);

console.log('\nlocalhostify ' + version);
console.log(`http://localhost:${port} -> ${config.target.host}`);

server.listen(port);
