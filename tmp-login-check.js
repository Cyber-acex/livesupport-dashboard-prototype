const http = require('http');
const postData = 'email=admin@livesupport.com&password=admin123&branchId=1';
const req = http.request({
  host: '127.0.0.1',
  port: 3000,
  path: '/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'text/html'
  }
}, (res) => {
  console.log('status', res.statusCode);
  console.log('set-cookie', JSON.stringify(res.headers['set-cookie']));
  let body = '';
  res.on('data', (c) => body += c);
  res.on('end', () => {
    console.log('location', res.headers.location);
    console.log(body.slice(0, 200));
  });
});
req.write(postData);
req.end();
