// Connect to MongoDB with Mongoose. Called once from server.js.
const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI missing in .env');
  // Strict query off to avoid deprecation noise; timeout keeps local dev fast-failing
  mongoose.set('strictQuery', false);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
};

module.exports = connectDB;
