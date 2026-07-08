const cloudinary = require('cloudinary').v2;
require('dotenv').config();

function cleanEnv(value) {
  if (!value) return '';
  return String(value).trim().replace(/;$/, '');
}

cloudinary.config({
  cloud_name: cleanEnv(process.env.CLOUDINARY_CLOUD_NAME),
  api_key: cleanEnv(process.env.CLOUDINARY_API_KEY),
  api_secret: cleanEnv(process.env.CLOUDINARY_API_SECRET),
});

module.exports = cloudinary;
