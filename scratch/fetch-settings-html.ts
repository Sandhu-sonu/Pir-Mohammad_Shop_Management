import http from 'http';

const sessionCookie = 'session=%7B%22userId%22%3A%22c38f538e-725f-4924-8ba6-62dcf6fa8a87%22%2C%22name%22%3A%22Baljinder%20Singh%22%2C%22role%22%3A%22OWNER%22%2C%22shopId%22%3A%222d3f0b1a-a591-4903-9c5a-00aa20531b08%22%2C%22businessType%22%3A%22GENERAL_STORE%22%2C%22mobile%22%3A%229876543210%22%2C%22shopName%22%3A%22Testing%20Shop%20Ltd%22%2C%22printerType%22%3A%22THERMAL_80%22%7D';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/settings',
  method: 'GET',
  headers: {
    'Cookie': sessionCookie
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', res.headers);
    // Write output to check
    const fs = require('fs');
    fs.writeFileSync('scratch/settings.html', data);
    console.log('Saved to scratch/settings.html. Length:', data.length);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
