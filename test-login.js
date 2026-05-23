import { db } from './db/database-prisma.js';

const email = 'cyberincognito15@gmail.com';
const password = '110089';
const sql = "SELECT * FROM users WHERE email = ? AND password = ?";

console.log('Testing login query...');
console.log('SQL:', sql);
console.log('Params:', [email, password]);

db.query(sql, [email, password], (err, result) => {
    if (err) {
        console.error('Query error:', err);
    } else {
        console.log('Query result:', result);
        console.log('Result length:', result ? result.length : 'null');
    }
    process.exit(0);
});

setTimeout(() => {
    console.log('Query timed out');
    process.exit(1);
}, 5000);
