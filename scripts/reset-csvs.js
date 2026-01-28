const fs = require('fs');
const path = require('path');

const HEADERS = {
    'students.csv': 'name,nickname,studentId,dob,gender,school,allergic,doNotEat,adConcent,phone,profilePicture,profileKey\n',
    'parents.csv': 'name,email,contactNo,lineId,address,profilePicture,profileKey\n',
    'sessions.csv': 'studentId,courseId,classOptionId,teacherId,status,payment\n',
    'parent_students.csv': 'parentName,studentId\n'
};

const DATA_DIR = path.join(__dirname, '../src/database/seeders/data');

Object.entries(HEADERS).forEach(([file, header]) => {
    const filePath = path.join(DATA_DIR, file);
    fs.writeFileSync(filePath, header);
    console.log(`Reset ${file}`);
});
