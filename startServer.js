const Koa = require('koa');
const fs = require('fs');
const path = require('path');
const websockify = require('koa-websocket');
const serve = require('koa-static');

const app = new Koa();

// app.use(ctx => {
//   ctx.response.type = 'html'; // 設定 response type
//   ctx.response.body = fs.createReadStream('./web/index.html'); // 設定 response 模版
// })

app.use(serve(path.join(__dirname+'/web')));

app.listen(3001)
// 3001 host 回應網站本身