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
let dbSeeded = false;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- Lazy MongoDB connection for Vercel serverless ---
let cachedConnection = null;

async function connectToDatabase() {
  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // If a connection attempt is in progress, wait for it
  if (cachedConnection) {
    await cachedConnection;
    return;
  }

  console.log('Connecting to MongoDB...');
  cachedConnection = mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
  });

  try {
    await cachedConnection;
    dbError = null;
    console.log('MongoDB successfully connected.');
    
    // Seed data only once per cold start
    if (!dbSeeded) {
      await seedEquipments();
      await seedFprs();
      await seedProjectEngineers();
      dbSeeded = true;
    }
  } catch (err) {
    cachedConnection = null; // Allow retry on next request
    dbError = err.message || String(err);
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

// Middleware to ensure DB connection before any API request
app.use(async (req, res, next) => {
  // Skip connection for health check
  if (req.path === '/health') {
    return next();
  }
  
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    // On Vercel, don't fall back to mock — return a clear error
    if (process.env.VERCEL) {
      return res.status(503).json({ 
        message: 'Database temporarily unavailable. Please try again in a moment.',
        error: err.message
      });
    }
    // Locally, fall back to mock DB
    console.warn('MongoDB connection failed. Falling back to In-Memory Database.');
    setUsingMock(true);
    next();
  }
});

// Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', async (req, res) => {
  // Try to connect if not connected
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectToDatabase();
    }
  } catch (e) {
    // Connection failed, that's okay — we'll report status
  }
  
  const maskedUri = MONGODB_URI ? MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:******@') : null;
  res.json({ 
    status: 'OK', 
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    dbName: mongoose.connection.readyState === 1 && mongoose.connection.db ? mongoose.connection.db.databaseName : null,
    uriUsed: maskedUri,
    error: dbError
  });
});

// Seed functions
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

// For local development, start the server directly
if (!process.env.VERCEL) {
  connectToDatabase()
    .then(() => {
      // Clean expired bin enquiries on startup
      return cleanExpiredBinEnquiries().catch(e => console.error('Bin cleanup error:', e));
    })
    .then(() => {
      return cleanDuplicateEnquiries().catch(e => console.error('Duplicate cleanup error:', e));
    })
    .then(() => {
      // Run cleanup hourly
      setInterval(cleanExpiredBinEnquiries, 3600000);
      // Run duplicate cleanup every 30 seconds
      setInterval(cleanDuplicateEnquiries, 30000);
      
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    })
    .catch(async (err) => {
      console.warn('MongoDB connection failed. Falling back to In-Memory Database.');
      setUsingMock(true);
      
      try { await cleanExpiredBinEnquiries(); } catch (e) {}
      try { await cleanDuplicateEnquiries(); } catch (e) {}
      setInterval(cleanExpiredBinEnquiries, 3600000);
      setInterval(cleanDuplicateEnquiries, 30000);
      
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT} (using In-Memory Database fallback)`);
      });
    });
}

export default app;
