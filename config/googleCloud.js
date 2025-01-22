// config/googleCloud.js
const { Storage } = require("@google-cloud/storage");
const path = require("path");

const storage = new Storage({
  keyFilename: path.join(__dirname, "/service-account-key.json"), // Path to the service account JSON file
});

const bucket = storage.bucket("shopper-product-images"); // Replace with your bucket name

module.exports = bucket;
