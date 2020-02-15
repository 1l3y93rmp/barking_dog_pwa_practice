const Koa = require('koa');
const send = require('koa-send');
const fs = require('fs');
const path = require('path');
const websockify = require('koa-websocket');
const serve = require('koa-static');
const mount = require('koa-mount');
const http = require('http');
const https = require('https');

const {
  default: sslify, // middleware factory 
  resolver: xForwardedProtoResolver // resolver needed
} = require('koa-sslify');


const app = new Koa();

// app.use(ctx => {
//   ctx.response.type = 'html'; // 設定 response type
//   ctx.response.body = fs.createReadStream('./web/index.html'); // 設定 response 模版
// })



app.use(
    serve(
        path.join(__dirname+'/web'),
        {
          setHeaders (res, path, stats) {
            res.setHeader('Cache-Control', 'private, max-age=30')
          },
        }
    )
);

const options = {
  key: fs.readFileSync('./ssl/localhost+1-key.pem', 'utf8'),
  cert: fs.readFileSync('./ssl/localhost+1.pem', 'utf8')
};

http.createServer(app.callback()).listen(3001); // 一般訪問於 3001 port
https.createServer(options, app.callback()).listen(3002); // SSL 加密訪問於 3002 port
