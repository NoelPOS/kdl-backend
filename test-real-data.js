const http = require('http');

const data = JSON.stringify({
  "id": 57,
  "name": "Test Student",
  "nickname": "test student",
  "gender": "Male",
  "school": "ABC",
  "allergic": [],
  "doNotEat": [],
  "nationalId": "1231231231234",
  "adConcent": false,
  "profilePicture": "https://kdl-image.s3.amazonaws.com/students/01.png"
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/students/57',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQHRlc3QuY29tIiwic3ViIjoxLCJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTg0NzAyODksImV4cCI6MTc1ODU1NjY4OX0.l1lxkteQ6jBJEiq8wA2CSLag0lEw81eMtybtB3-bTOs',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let responseBody = '';
  res.on('data', (chunk) => {
    responseBody += chunk;
  });
  
  res.on('end', () => {
    console.log('Response Body:', responseBody);
    try {
      const parsed = JSON.parse(responseBody);
      console.log('Parsed Response:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Could not parse response as JSON');
    }
  });
});

req.on('error', (error) => {
  console.error(`Request error: ${error}`);
});

req.write(data);
req.end();