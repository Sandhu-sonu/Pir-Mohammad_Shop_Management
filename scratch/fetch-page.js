const http = require('http');

http.get('http://localhost:3000/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', res.headers);
    console.log('HTML PREVIEW (first 500 chars):');
    console.log(data.substring(0, 500));
  });
}).on('error', (err) => {
  console.error('Error fetching page:', err.message);
});
