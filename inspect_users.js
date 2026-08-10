import mongoose from 'mongoose';

const MONGODB_URI = "mongodb+srv://enquiry_db_user:NBTrzNkq86zrXV8X@cluster0.cw4rhmz.mongodb.net/enquiry_portal?retryWrites=true&w=majority";

const userSchema = new mongoose.Schema({
  name: String,
  username: String,
  role: String
}, { collection: 'users', strict: false });

const User = mongoose.model('User', userSchema);

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");
    
    const users = await User.find();
    console.log("Total Users in DB:", users.length);
    for (const u of users) {
      const obj = u.toObject ? u.toObject() : u;
      console.log(`ID: ${obj._id}, Username: ${obj.username}, Name: ${obj.name}, Role: "${obj.role}", Verified: ${obj.isEmailVerified}`);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
