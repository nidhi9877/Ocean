import http from 'http';

const testRegistration = async (payload) => {
  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: JSON.parse(data) });
      });
    });

    req.on('error', (e) => {
      resolve({ error: e.message });
    });

    req.write(postData);
    req.end();
  });
};

const runTests = async () => {
    console.log("=== Test 1: Weak Password ===");
    const res1 = await testRegistration({
      username: 'testuser123',
      password: 'weakpassword',
      role: 'buyer',
      email: 'testuser123@example.com',
      phone: '1234567890',
      imo_number: '12345',
      ship_name: 'Ship',
      ship_type: 'Other'
    });
    console.log(res1);

    console.log("\n=== Test 2: Valid Registration ===");
    const res2 = await testRegistration({
      username: 'testuser123',
      password: 'StrongPassword123!',
      role: 'buyer',
      email: 'testuser123@example.com',
      phone: '1234567890',
      imo_number: '12345',
      ship_name: 'Ship',
      ship_type: 'Other'
    });
    console.log(res2);

    console.log("\n=== Test 3: Duplicate Username ===");
    const res3 = await testRegistration({
      username: 'testuser123', // Same username
      password: 'StrongPassword123!',
      role: 'buyer',
      email: 'differentemail@example.com',
      phone: '1234567890',
      imo_number: '12345',
      ship_name: 'Ship',
      ship_type: 'Other'
    });
    console.log(res3);

    console.log("\n=== Test 4: Duplicate Email ===");
    const res4 = await testRegistration({
      username: 'differentuser123',
      password: 'StrongPassword123!',
      role: 'buyer',
      email: 'testuser123@example.com', // Same email
      phone: '1234567890',
      imo_number: '12345',
      ship_name: 'Ship',
      ship_type: 'Other'
    });
    console.log(res4);
};

runTests();
