const http = require('http');
const querystring = require('querystring');
const jar = {};

function request(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = { hostname: 'localhost', port: 3000, path, method: 'GET', headers };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function login() {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({ email: 'agent1@livesupport.com', password: 'password123', branchId: '1' });
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = http.request(options, (res) => {
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        for (const cookie of setCookie) {
          const [pair] = cookie.split(';');
          const [k, ...rest] = pair.split('=');
          jar[k] = rest.join('=');
        }
      }
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end(postData);
  });
}

(async () => {
  const loginRes = await login();
  console.log('loginStatus', loginRes.status);
  console.log('loginLocation', loginRes.headers.location);
  console.log('cookieJar', jar);
  const cookieHeader = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  const dash = await request('/dashboard', { Cookie: cookieHeader });
  console.log('dashboardStatus', dash.status);
  console.log('dashboardSnippet', dash.body.slice(0, 220));
  const user = await request('/api/user', { Cookie: cookieHeader });
  console.log('userStatus', user.status);
  console.log('userBody', user.body.slice(0, 400));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
