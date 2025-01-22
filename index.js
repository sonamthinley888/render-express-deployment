const express = require("express");
const app = express();
const port = process.env.PORT || 4000;

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const multer = require("multer");
const multerGoogleStorage = require("multer-google-storage");
const bucket = require("./config/googleCloud"); // Import Google Cloud Storage config

const path = require("path");
const cors = require("cors");
const { log } = require("console");
const { stringify } = require("querystring");
const { fstat } = require("fs");

app.use(express.json());
app.use(cors()); // This allows all origins

// Database Connection with MongoDB
mongoose.connect(
  "mongodb+srv://coder_91:uECOnjGAtng3UDhV@cluster0.ln6blra.mongodb.net/e-commerce"
);

// Create multer storage engine that uploads directly to Google Cloud Storage
const storage = multerGoogleStorage.storageEngine({
  bucket: "shopper-product-images", // Replace with your bucket name
  projectId: "crypto-groove-448608-s4", // Replace with your Google Cloud project ID
  acl: "publicRead", // Public read access
  keyFilename: "/service-account-key.json", // Path to your service account file
});

// Multer upload middleware
const upload = multer({ storage });

//Creating Upload Endpoint for Images

app.use("/images", express.static("upload/images"));

// Route to upload image
app.post("/upload", upload.single("product"), (req, res) => {
  if (!req.file) {
    return res.status(400).send({ error: "No file uploaded" });
  }

  const imageUrl = `https://storage.googleapis.com/${req.file.bucket}/${req.file.filename}`;
  res.json({ success: 1, image_url: imageUrl });
});

// // Schema for Creating Products

const Product = mongoose.model("Product", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
});

app.post("/addproduct", async (req, res) => {
  let products = await Product.find({});
  let id;
  if (products.length > 0) {
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id + 1;
  } else {
    id = 1;
  }

  const product = new Product({
    id: id,
    name: req.body.name,
    image: req.body.image,
    category: req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price,
  });
  console.log(product);
  await product.save();
  console.log("Saved");
  res.json({
    success: true,
    name: req.body.name,
  });
});

// Creating API for deleting Products
app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  console.log("Removed");
  res.json({
    success: true,
    name: req.body.name,
  });
});

// Creating API for getting all products
app.get("/allproducts", async (req, res) => {
  try {
    let products = await Product.find({}); // Fetch products from database
    console.log("All Products Fetched");

    // Send a structured response
    res.json({
      success: true,
      products: products,
    });
  } catch (error) {
    console.error("Error fetching products:", error);

    // Send error response with proper status and message
    res.status(500).json({
      success: false,
      error: "Failed to fetch products",
      details: error.message, // Include error details for debugging
    });
  }
});

// Schema creating for user model

const Users = mongoose.model("Users", {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

// Creating Endpoint for registering the user
app.post("/signup", async (req, res) => {
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({
      success: false,
      errors: "existing user found with same email address",
    });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }
  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });

  await user.save();

  const data = {
    user: {
      id: user.id,
    },
  };

  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});

// Creating endpoint for user login
app.post("/login", async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id,
        },
      };
      const token = jwt.sign(data, "secret_ecom");
      res.json({ success: true, token });
    } else {
      res.json({ success: false, errors: "Wrong Password" });
    }
  } else {
    res.json({ success: false, errors: "Wrong Email Id" });
  }
});

// Creating endpoint for new collection data
app.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  let newcollection = products.slice(1).slice(-8);
  console.log("New Collection Fetched");
  res.json(newcollection); // Use res.json() to ensure the response is treated as JSON
});

// Creating endpoint for popular in women section
app.get("/popularinwomen", async (req, res) => {
  let product = await Product.find({ category: "women" });
  let popular_in_women = product.slice(0, 4);
  console.log("Popular in women fetched");
  res.json(popular_in_women); // Use res.json() here as well
});

// Creating middelware to fetch user
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    res.status(401).send({ errors: "Please authenticate using valid token" });
  } else {
    try {
      const data = jwt.verify(token, "secret_ecom");
      req.user = data.user;
      next();
    } catch (error) {
      res
        .status(401)
        .send({ errors: "Please authenticate using a valid token" });
    }
  }
};

// Creating endpoint for adding products in cartdata
app.post("/addtocart", fetchUser, async (req, res) => {
  console.log("added", req.body.itemId);
  let userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.json({ message: "Added", success: true });
});

// Creating endpoint to remove product from cartdata
app.post("/removefromcart", fetchUser, async (req, res) => {
  console.log("removed", req.body.itemId);
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.json({ message: "Removed", success: true });
});

// Creating endpoint to get cart data
app.post("/getcart", fetchUser, async (req, res) => {
  console.log("GetCart");
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

// Root Route
app.get("/", (req, res) => {
  res.json({ message: "Express App is running on Render" }); // Return as JSON
});

// Start Server (Only ONE app.listen)
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
