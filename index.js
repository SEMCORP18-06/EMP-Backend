import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

import apiRouter from './routes.js';
import { User, Equipment, Fpr, ProjectEngineer } from './models.js';
import { setUsingMock, cleanExpiredBinEnquiries, cleanDuplicateEnquiries } from './db.js';

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://enquiry_db_user:NBTrzNkq86zrXV8X@ac-z2c3869-shard-00-00.cw4rhmz.mongodb.net:27017,ac-z2c3869-shard-00-01.cw4rhmz.mongodb.net:27017,ac-z2c3869-shard-00-02.cw4rhmz.mongodb.net:27017/enquiry_portal?ssl=true&replicaSet=atlas-feob8t-shard-0&authSource=admin';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secret_session_key_enquiry_portal_2026';

let dbError = null;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    dbName: mongoose.connection.readyState === 1 ? mongoose.connection.db.databaseName : null,
    error: dbError
  });
});

// Seed function for Admin & General users
async function seedUsers() {
  // Seeding disabled to remove default login credentials
}

async function seedEquipments() {
  try {
    const count = await Equipment.countDocuments();
    if (count === 0) {
      const defaultEquips = ["CHPR", "DC", "HE", "ATFE", "ATFD", "SPDU", "LLE", "DVP", "VB"];
      await Equipment.insertMany(defaultEquips.map(name => ({ name })));
      console.log('Seeded default equipments in MongoDB.');
    }
  } catch (error) {
    console.error('Error seeding equipments:', error);
  }
}

async function seedFprs() {
  try {
    const count = await Fpr.countDocuments();
    if (count === 0) {
      const defaultFprs = [
        { name: "Mr. Mahendra Yadav", email: "Mahendra.y@semcogroups.com" },
        { name: "Mr. Jogender Dhayal", email: "Jogender.d@semcogroups.com" },
        { name: "Ms. Rutuja Adak", email: "Rutuja.a@semcogroups.com" },
        { name: "Mr. Umesh Patil", email: "Umesh.p@semcogroups.com" },
        { name: "Ms. Arati Janokar", email: "Aarti.j@semcogroups.com" },
        { name: "Mr. Pratik Patil", email: "Pratik.p@semcogroups.com" },
        { name: "Mr. Shrikant Munje", email: "store.semcorp@semcogroups.com" }
      ];
      await Fpr.insertMany(defaultFprs);
      console.log('Seeded default FPRs in MongoDB.');
    }
  } catch (error) {
    console.error('Error seeding FPRs:', error);
  }
}

async function seedProjectEngineers() {
  try {
    const count = await ProjectEngineer.countDocuments();
    if (count === 0) {
      const defaultProjectEngineers = [
        { name: "Pratik Patil", email: "pratik.p@semcogroups.com", contactNumber: "9684011617" }
      ];
      await ProjectEngineer.insertMany(defaultProjectEngineers);
      console.log('Seeded default project engineers in MongoDB.');
    }
  } catch (error) {
    console.error('Error seeding project engineers:', error);
  }
}

// Connect to MongoDB and Start Server
console.log('Connecting to MongoDB...');
mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(async () => {
    console.log('MongoDB successfully connected.');
    // Seed initial users
    // await seedUsers();
    // Seed initial equipments
    await seedEquipments();
    // Seed initial FPRs
    await seedFprs();
    // Seed initial project engineers
    await seedProjectEngineers();
    
    // Clean expired bin enquiries on startup
    try {
      await cleanExpiredBinEnquiries();
    } catch (cleanErr) {
      console.error('Error in startup bin cleanup:', cleanErr);
    }
    // Clean duplicate enquiries on startup
    try {
      await cleanDuplicateEnquiries();
    } catch (dupErr) {
      console.error('Error in startup duplicate cleanup:', dupErr);
    }
    // Run cleanup hourly
    setInterval(cleanExpiredBinEnquiries, 3600000);
    // Run duplicate cleanup every 30 seconds
    setInterval(cleanDuplicateEnquiries, 30000);
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(async (err) => {
    dbError = err.message || String(err);
    console.error('MongoDB connection error details:', err);

    if (process.env.VERCEL) {
      console.error('Vercel environment detected: Database connection is required. NOT falling back to In-Memory Database.');
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT} (Vercel mode: connection required)`);
      });
      return;
    }

    console.warn('MongoDB connection failed. Falling back to In-Memory Database.');
    setUsingMock(true);
    
    // Clean expired bin enquiries on startup for mock fallback
    try {
      await cleanExpiredBinEnquiries();
    } catch (cleanErr) {
      console.error('Error in startup bin cleanup (mock):', cleanErr);
    }
    // Clean duplicate enquiries on startup for mock fallback
    try {
      await cleanDuplicateEnquiries();
    } catch (dupErr) {
      console.error('Error in startup duplicate cleanup (mock):', dupErr);
    }
    // Run cleanup hourly
    setInterval(cleanExpiredBinEnquiries, 3600000);
    // Run duplicate cleanup every 30 seconds
    setInterval(cleanDuplicateEnquiries, 30000);
    
    console.log('No pre-seeded mock credentials. Please sign up a new account.');
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} (using In-Memory Database fallback)`);
    });
  });

export default app;
