// generate-jwt-keys.js
const crypto = require('crypto');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

const toSingleLine = (pem) => pem.trim().replace(/\n/g, '\\n');

console.log('=== JWT_PUBLIC_KEY ===');
console.log(toSingleLine(publicKey));
console.log('\n=== JWT_PRIVATE_KEY ===');
console.log(toSingleLine(privateKey));