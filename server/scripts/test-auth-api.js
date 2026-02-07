const http = require('http');

const data = JSON.stringify({
    username: 'admin',
    password: 'password123',
    rememberMe: false
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('Testing Login API...');
console.log(`Target: http://localhost:3001/api/auth/login`);

const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);

    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Response Body:', body);

        if (res.statusCode === 200) {
            console.log('\n✅ Login API Success!');
        } else if (res.statusCode === 404) {
            console.log('\n❌ Error: 404 Not Found');
            console.log('👉 The server is running, but the /api/auth/login route is missing.');
            console.log('👉 DID YOU RESTART THE SERVER? (Ctrl+C and npm start)');
        } else {
            console.log('\n❌ Login Failed');
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error.message);
    console.log('👉 Is the server running?');
});

req.write(data);
req.end();
