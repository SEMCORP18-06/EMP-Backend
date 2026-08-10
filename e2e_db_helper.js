import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://enquiry_db_user:NBTrzNkq86zrXV8X@ac-z2c3869-shard-00-00.cw4rhmz.mongodb.net:27017,ac-z2c3869-shard-00-01.cw4rhmz.mongodb.net:27017,ac-z2c3869-shard-00-02.cw4rhmz.mongodb.net:27017/enquiry_portal?ssl=true&replicaSet=atlas-feob8t-shard-0&authSource=admin";

async function run() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.error('Usage: node e2e_db_helper.js <command> [args]');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[DB Helper] Connected to MongoDB.');

    if (command === 'verify-user') {
      const email = args[1];
      const role = args[2] || 'Admin';

      if (!email) {
        console.error('Email required for verify-user.');
        process.exit(1);
      }

      // We import models dynamically
      const { User } = await import('./models.js');
      const updatedUser = await User.findOneAndUpdate(
        { username: email.toLowerCase().trim() },
        { 
          isEmailVerified: true,
          role: role
        },
        { new: true }
      );

      if (updatedUser) {
        console.log(`[DB Helper] Successfully verified and set role of "${email}" to "${role}".`);
      } else {
        console.error(`[DB Helper] User "${email}" not found in database.`);
      }
    } else if (command === 'seed-milestones') {
      const qtn = args[1];
      if (!qtn) {
        console.error('Quotation number required for seed-milestones.');
        process.exit(1);
      }

      const { Enquiry } = await import('./models.js');
      const todayStr = new Date().toISOString().split('T')[0];
      const nextWeekStr = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
      const updatedEnquiry = await Enquiry.findOneAndUpdate(
        { quotationNumber: qtn.trim() },
        { 
          milestones: [
            {
              name: "Engineering Design",
              fpr: "E2E Test FPR",
              startDate: todayStr,
              endDate: nextWeekStr,
              actualEndDate: "",
              status: "In Progress",
              remark: "",
              percentage: 100
            }
          ]
        },
        { new: true }
      );

      if (updatedEnquiry) {
        console.log(`[DB Helper] Successfully seeded 1 milestone for enquiry "${qtn}".`);
      } else {
        console.error(`[DB Helper] Enquiry with quotationNumber "${qtn}" not found.`);
      }
    } else if (command === 'cleanup') {
      const { User, Enquiry, ProjectEngineer, Fpr, Equipment } = await import('./models.js');

      // We delete any E2E / Test related entities to keep DB clean
      const userRes = await User.deleteMany({
        $or: [
          { username: { $regex: 'e2e_test', $options: 'i' } },
          { username: { $regex: 'test_admin', $options: 'i' } },
          { username: { $regex: 'test_general', $options: 'i' } },
          { name: { $regex: 'e2e', $options: 'i' } }
        ]
      });
      console.log(`[DB Helper] Deleted ${userRes.deletedCount} test users.`);

      const enquiryRes = await Enquiry.deleteMany({
        $or: [
          { clientName: { $regex: 'e2e', $options: 'i' } },
          { companyName: { $regex: 'e2e', $options: 'i' } },
          { quotationNumber: { $regex: 'E2E', $options: 'i' } }
        ]
      });
      console.log(`[DB Helper] Deleted ${enquiryRes.deletedCount} test enquiries.`);

      const peRes = await ProjectEngineer.deleteMany({
        $or: [
          { name: { $regex: 'e2e', $options: 'i' } },
          { email: { $regex: 'e2e', $options: 'i' } }
        ]
      });
      console.log(`[DB Helper] Deleted ${peRes.deletedCount} test project engineers.`);

      const fprRes = await Fpr.deleteMany({
        $or: [
          { name: { $regex: 'e2e', $options: 'i' } },
          { email: { $regex: 'e2e', $options: 'i' } }
        ]
      });
      console.log(`[DB Helper] Deleted ${fprRes.deletedCount} test FPRs.`);

      const equipRes = await Equipment.deleteMany({
        name: { $regex: 'e2e', $options: 'i' }
      });
      console.log(`[DB Helper] Deleted ${equipRes.deletedCount} test equipments.`);
    } else {
      console.error(`Unknown command: ${command}`);
    }
  } catch (err) {
    console.error('[DB Helper] Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('[DB Helper] Disconnected from MongoDB.');
  }
}

run();
