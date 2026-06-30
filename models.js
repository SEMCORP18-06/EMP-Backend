import mongoose from 'mongoose';

const enquirySchema = new mongoose.Schema({
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  quotationNumber: { type: String, default: "" },
  clientName: { type: String, required: true },
  companyName: { type: String, required: true },
  enquiryDetails: { type: String, required: true },
  majorEquipments: { type: String, required: true },
  enquirySource: { type: String, required: true },
  fpr: { type: String },
  mailId: { type: String, required: true },
  contactCountryCode: { type: String, required: true },
  contactNumber: { type: String, required: true },
  currentStatus: {
    type: String,
    enum: [
      "Costing",
      "Offer submitted",
      "Follow-up in progress",
      "Quotation Submitted",
      "Negotiation ongoing",
      "Lost",
      "Confirmed",
      "-"
    ],
    default: "Costing"
  },
  offerSubmittedDate: { type: String, default: "" },
  poNumber: { type: String, default: "" },
  expectedDateOfDispatch: { type: String, default: "" },
  projectEngineer: { type: String, default: "" },
  followUpComments: { type: String, default: "" },
    milestones: {
      type: [{
        name: { type: String, required: true },
        fpr: { type: String, default: "" },
        startDate: { type: String, default: "" },
        endDate: { type: String, default: "" },
        actualEndDate: { type: String, default: "" },
        status: { type: String, enum: ["Pending", "In Progress", "Completed"], default: "Pending" },
        remark: { type: String, default: "" },
        percentage: { type: Number, default: 0 }
      }],
      default: []
    },
    createdBy: { type: String, default: "" }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["Admin", "General", ""], default: "" },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: null },
  resetOtp: { type: String, default: null },
  resetOtpExpires: { type: Date, default: null }
}, { timestamps: true });

const binEnquirySchema = new mongoose.Schema({
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  quotationNumber: { type: String, default: "" },
  clientName: { type: String, required: true },
  companyName: { type: String, required: true },
  enquiryDetails: { type: String, required: true },
  majorEquipments: { type: String, required: true },
  enquirySource: { type: String, required: true },
  fpr: { type: String },
  mailId: { type: String, required: true },
  contactCountryCode: { type: String, required: true },
  contactNumber: { type: String, required: true },
  currentStatus: {
    type: String,
    enum: [
      "Costing",
      "Offer submitted",
      "Follow-up in progress",
      "Quotation Submitted",
      "Negotiation ongoing",
      "Lost",
      "Confirmed",
      "-"
    ],
    default: "Costing"
  },
  offerSubmittedDate: { type: String, default: "" },
  poNumber: { type: String, default: "" },
  expectedDateOfDispatch: { type: String, default: "" },
  projectEngineer: { type: String, default: "" },
  followUpComments: { type: String, default: "" },
  milestones: {
    type: [{
      name: { type: String, required: true },
      fpr: { type: String, default: "" },
      startDate: { type: String, default: "" },
      endDate: { type: String, default: "" },
      actualEndDate: { type: String, default: "" },
      status: { type: String, enum: ["Pending", "In Progress", "Completed"], default: "Pending" },
      remark: { type: String, default: "" },
      percentage: { type: Number, default: 0 }
    }],
    default: []
  },
  createdBy: { type: String, default: "" }
}, { timestamps: true });

binEnquirySchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export const Enquiry = mongoose.model('Enquiry', enquirySchema);
export const User = mongoose.model('User', userSchema);
export const BinEnquiry = mongoose.model('BinEnquiry', binEnquirySchema, 'bin_enquiries');

const equipmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
}, { timestamps: true });

export const Equipment = mongoose.model('Equipment', equipmentSchema);

const fprSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  email: { type: String, default: "" }
}, { timestamps: true });

export const Fpr = mongoose.model('Fpr', fprSchema);

const projectEngineerSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  email: { type: String, default: "" },
  contactNumber: { type: String, default: "" }
}, { timestamps: true });

export const ProjectEngineer = mongoose.model('ProjectEngineer', projectEngineerSchema);


