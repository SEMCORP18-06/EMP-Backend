import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dns from 'dns/promises';
import { dbUser as User, dbEnquiry as Enquiry, dbBinEnquiry as BinEnquiry, dbEquipment as Equipment, dbFpr as Fpr, dbProjectEngineer as ProjectEngineer, cleanDuplicateEnquiries, isDuplicate, normalizeDate } from './db.js';
import { authenticateToken, requireAdmin, requireActiveRole } from './auth.js';

const mapStatus = (status) => {
  if (!status) return "-";
  const clean = status.trim().toLowerCase();
  
  if (clean.includes("costing")) return "Costing";
  if (clean.includes("offer")) return "Offer submitted";
  if (clean.includes("follow-up") || clean.includes("followup") || clean.includes("in progress")) return "Follow-up in progress";
  if (clean.includes("quotation")) return "Quotation Submitted";
  if (clean.includes("negotiation")) return "Negotiation ongoing";
  if (clean.includes("lost") || clean.includes("loss")) return "Lost";
  if (clean.includes("confirmed") || clean.includes("converted") || clean.includes("convert")) return "Confirmed";
  
  return "-";
};

const router = express.Router();

// Resolve SMTP Host to single IPv4 address at load time to prevent multiple slow DNS connection retries on blocked networks (like Render)
let smtpHost = process.env.SMTP_HOST || 'smtp.office365.com';
let resolvedHost = smtpHost;

if (!/^[0-9.]+$/.test(smtpHost)) {
  try {
    const addresses = await dns.resolve4(smtpHost);
    if (addresses && addresses.length > 0) {
      resolvedHost = addresses[0];
      console.log(`[SMTP Config] Resolved host ${smtpHost} to IPv4: ${resolvedHost}`);
    }
  } catch (dnsErr) {
    console.error(`[SMTP Config] Failed to resolve IPv4 address for ${smtpHost}:`, dnsErr.message);
  }
}

// SMTP Transporter setup using credentials provided
const transporter = nodemailer.createTransport({
  host: resolvedHost,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // False for port 587 (uses STARTTLS)
  auth: {
    user: process.env.SMTP_USER || 'aarti.j@semcogroups.com',
    pass: process.env.SMTP_PASS || '$emc0rp@2026'
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false,
    servername: smtpHost
  },
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000, // 10 seconds
  socketTimeout: 10000 // 10 seconds
});


const ensureMilestonePercentages = (milestones) => {
  if (!milestones || milestones.length === 0) return [];
  milestones.forEach(m => {
    if (typeof m.percentage !== 'number') {
      m.percentage = Number(m.percentage) || 0;
    }
  });
  return milestones;
};

const userHasEnquiryAccess = async (user, enquiry) => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  if (enquiry.createdBy === user.username) return true;
  if (enquiry.projectEngineer && enquiry.projectEngineer !== '-') {
    const pe = await ProjectEngineer.findOne({
      email: { $regex: `^${user.username.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' }
    });
    if (pe && pe.name.trim().toLowerCase() === enquiry.projectEngineer.trim().toLowerCase()) {
      return true;
    }
  }
  return false;
};

const sendVerificationEmail = async (email, token) => {
  const backendUrl = process.env.BACKEND_URL || 'https://emp-backend-amber.vercel.app';
  const verificationLink = `${backendUrl}/api/auth/verify-email?token=${token}`;
  
  // Output link directly to console for testing/debugging convenience
  console.log('\n----------------------------------------');
  console.log(`[VERIFICATION EMAIL SENT TO]: ${email}`);
  console.log(`[VERIFICATION LINK]: ${verificationLink}`);
  console.log('----------------------------------------\n');

  const mailOptions = {
    from: `"SEMCO Portal" <${process.env.SMTP_USER || 'aarti.j@semcogroups.com'}>`,
    to: email,
    subject: 'Verify Your Email - SEMCO Enquiry Management Portal',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #3f51b5; margin: 0;">SEMCO Groups</h2>
          <span style="color: #777777; font-size: 0.9rem;">Enquiry Management Portal</span>
        </div>
        <hr style="border: 0; border-top: 1px solid #eeeeee;" />
        <h3 style="color: #333333; margin-top: 24px;">Email Verification Required</h3>
        <p style="color: #555555; font-size: 1rem; line-height: 1.6;">
          Thank you for signing up on the SEMCO Enquiry Management Portal. To complete your registration and activate your account, please click the button below to verify your email address:
        </p>
        <div style="text-align: center; margin: 40px 0;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${verificationLink}" style="height:52px;v-text-anchor:middle;width:220px;" arcsize="15%" strokecolor="#1a73e8" fillcolor="#1a73e8">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">✉ Verify Email</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${verificationLink}" style="background-color: #1a73e8; color: #ffffff !important; padding: 16px 48px; font-size: 1.1rem; font-weight: 700; text-decoration: none; border-radius: 10px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 6px 20px rgba(26, 115, 232, 0.35); mso-hide: all;">
            ✉ Verify Email
          </a>
          <!--<![endif]-->
        </div>
        <p style="color: #777777; font-size: 0.85rem; line-height: 1.5;">
          If the button doesn't work, you can copy and paste this verification link directly into your browser's address bar:
        </p>
        <p style="color: #3f51b5; font-size: 0.85rem; word-break: break-all; background: #f5f5f5; padding: 12px; border-radius: 6px;">
          ${verificationLink}
        </p>
        <p style="color: #999999; font-size: 0.8rem; margin-top: 32px; text-align: center;">
          &copy; 2026 SEMCO Groups. All rights reserved.
        </p>
      </div>
    `
  };
  await transporter.sendMail(mailOptions);
};

const sendResetOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: `"SEMCO Portal" <${process.env.SMTP_USER || 'aarti.j@semcogroups.com'}>`,
    to: email,
    subject: 'Password Reset OTP - SEMCO Enquiry Management Portal',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1a73e8; margin: 0;">SEMCO Groups</h2>
          <span style="color: #777777; font-size: 0.9rem;">Enquiry Management Portal</span>
        </div>
        <hr style="border: 0; border-top: 1px solid #eeeeee;" />
        <h3 style="color: #333333; margin-top: 24px;">Password Reset Request</h3>
        <p style="color: #555555; font-size: 1rem; line-height: 1.6;">
          You requested to reset your password. Use the following One-Time Password (OTP) to complete the reset. This OTP is valid for <strong>only 2 minutes</strong>:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <span style="background-color: #f5f5f5; color: #1a73e8; padding: 12px 24px; font-size: 1.8rem; font-weight: bold; border-radius: 8px; letter-spacing: 4px; display: inline-block; border: 1px dashed #1a73e8;">
            ${otp}
          </span>
        </div>
        <p style="color: #d93025; font-size: 0.85rem; font-weight: bold;">
          ⚠️ For security, do not share this OTP with anyone. If you did not request a password reset, please ignore this email.
        </p>
        <p style="color: #999999; font-size: 0.8rem; margin-top: 32px; text-align: center;">
          &copy; 2026 SEMCO Groups. All rights reserved.
        </p>
      </div>
    `
  };
  await transporter.sendMail(mailOptions);
};

// Authentication endpoint
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Block login if email is not verified
    if (user.isEmailVerified === false) {
      return res.status(403).json({ 
        message: 'Please verify your email address before logging in. A verification link was sent to your email.' 
      });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      user: {
        username: user.username,
        role: user.role,
        name: user.name || ''
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Registration endpoint
router.post('/auth/register', async (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  // Password complexity check
  if (password.length < 7 || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return res.status(400).json({ 
      message: 'Password must be at least 7 characters long and contain at least one special character.' 
    });
  }

  // Email domain check
  if (!username.toLowerCase().endsWith('@semcogroups.com')) {
    return res.status(400).json({ 
      message: 'Domain Name incorrect' 
    });
  }

  try {
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name: name || '',
      username,
      password: hashedPassword,
      role: 'General', // Keep it General by default
      isEmailVerified: false,
      emailVerificationToken
    });

    // Send verification email asynchronously
    try {
      await sendVerificationEmail(username, emailVerificationToken);
    } catch (emailErr) {
      console.error('Failed to send verification email during signup:', emailErr);
    }

    return res.status(201).json({
      message: 'Registration successful! Verification email sent.',
      user: {
        username: newUser.username,
        name: newUser.name || ''
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Email verification callback URL
router.get('/auth/verify-email', async (req, res) => {
  const { token } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'https://semcorpemp.vercel.app';

  if (!token) {
    return res.redirect(`${frontendUrl}/?verified=invalid`);
  }

  try {
    const user = await User.findOne({ emailVerificationToken: token });
    if (!user) {
      return res.redirect(`${frontendUrl}/?verified=invalid`);
    }

    // Verify user and clear token
    await User.updateOne(
      { _id: user._id },
      { 
        isEmailVerified: true, 
        emailVerificationToken: null 
      }
    );

    return res.redirect(`${frontendUrl}/?verified=success`);
  } catch (error) {
    console.error('Email verification error:', error);
    return res.redirect(`${frontendUrl}/?verified=error`);
  }
});

// Request verification OTP for forgot password
router.post('/auth/forgot-password', async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Username (email) is required.' });
  }

  try {
    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Valid for 2 minutes
    const expires = new Date(Date.now() + 2 * 60 * 1000);

    // Save OTP to user document
    await User.updateOne(
      { _id: user._id },
      {
        resetOtp: otp,
        resetOtpExpires: expires
      }
    );

    // Send email
    try {
      await sendResetOtpEmail(user.username, otp);
    } catch (emailErr) {
      console.error('Failed to send reset OTP email:', emailErr);
      return res.status(500).json({ message: 'Failed to send OTP email.' });
    }

    return res.json({ message: 'Verification OTP sent to your email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Verify OTP and reset password
router.post('/auth/reset-password', async (req, res) => {
  const { username, otp, newPassword } = req.body;
  if (!username || !otp || !newPassword) {
    return res.status(400).json({ message: 'All fields (email, OTP, new password) are required.' });
  }

  // Password complexity check
  if (newPassword.length < 7 || !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
    return res.status(400).json({ 
      message: 'Password must be at least 7 characters long and contain at least one special character.' 
    });
  }

  try {
    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify OTP and expiration
    if (!user.resetOtp || user.resetOtp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (!user.resetOtpExpires || new Date(user.resetOtpExpires).getTime() < Date.now()) {
      return res.status(400).json({ message: 'OTP has expired (valid for 2 minutes)' });
    }

    // Hash and update password, clear OTP
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne(
      { _id: user._id },
      {
        password: hashedPassword,
        resetOtp: null,
        resetOtpExpires: null
      }
    );

    return res.json({ message: 'Password reset successful! You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET current user profile details (synchronized from DB)
router.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.user.username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({
      username: user.username,
      role: user.role,
      name: user.name || ''
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Enquiries CRUD endpoints

// GET all enquiries - Accessible to both Admin and General
router.get('/enquiries', authenticateToken, requireActiveRole, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'General') {
      const pe = await ProjectEngineer.findOne({
        email: { $regex: `^${req.user.username.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' }
      });
      if (pe) {
        query = {
          $or: [
            { createdBy: req.user.username },
            { projectEngineer: pe.name }
          ]
        };
      } else {
        query = { createdBy: req.user.username };
      }
    }
    const enquiries = await Enquiry.find(query).sort({ createdAt: -1 });
    return res.json(enquiries);
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    return res.status(500).json({ message: 'Error fetching enquiries' });
  }
});

// POST new enquiry - Admin and General
router.post('/enquiries', authenticateToken, requireActiveRole, async (req, res) => {
  try {
    const {
      date,
      quotationNumber,
      clientName,
      companyName,
      enquiryDetails,
      majorEquipments,
      enquirySource,
      fpr,
      mailId,
      contactCountryCode,
      contactNumber,
      currentStatus,
      offerSubmittedDate,
      poNumber,
      expectedDateOfDispatch,
      projectEngineer,
      followUpComments
    } = req.body;

    let normalizedCC = (contactCountryCode || '').trim();
    if (normalizedCC && !normalizedCC.startsWith('+')) {
      normalizedCC = '+' + normalizedCC;
    }

    const normalizedDate = normalizeDate(date || new Date().toISOString().split('T')[0]);
    const normalizedOfferDate = normalizeDate(offerSubmittedDate);
    const normalizedExpectedDispatchDate = normalizeDate(expectedDateOfDispatch);

    // Validation checks
    if (currentStatus === 'Quotation Submitted' && (!quotationNumber || !quotationNumber.trim())) {
      return res.status(400).json({ message: 'Please Enter the Quotation Number' });
    }
    if (currentStatus === 'Confirmed' && (!poNumber || !poNumber.trim())) {
      return res.status(400).json({ message: 'Please Enter the PO Number' });
    }
    if (currentStatus === 'Confirmed' && (!expectedDateOfDispatch || !expectedDateOfDispatch.trim() || expectedDateOfDispatch === '-')) {
      return res.status(400).json({ message: 'Please Enter the Expected Date Of Dispatch' });
    }
    if (currentStatus === 'Confirmed' && (!projectEngineer || !projectEngineer.trim() || projectEngineer === '-')) {
      return res.status(400).json({ message: 'Please select a Project Engineer' });
    }

    // Check duplicates before insert
    let duplicateList = [];
    if (quotationNumber && quotationNumber.trim()) {
      duplicateList = await Enquiry.find({ 
        quotationNumber: { $regex: `^${quotationNumber.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } 
      }).sort({ createdAt: -1 });
    }
    if (duplicateList.length === 0) {
      const potential = await Enquiry.find({
        companyName: { $regex: `^${companyName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' },
        clientName: { $regex: `^${clientName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' }
      }).sort({ createdAt: -1 });

      const newEnqObj = { clientName, companyName, contactNumber, mailId, majorEquipments };
      const matched = potential.find(p => isDuplicate(p, newEnqObj));
      if (matched) {
        duplicateList = [matched];
      }
    }

    if (duplicateList.length > 0) {
      return res.status(400).json({ message: 'Enquiry already exists (Duplicate found)' });
    }

    const savedEnquiry = await Enquiry.create({
      date: normalizedDate,
      quotationNumber: quotationNumber || '',
      clientName,
      companyName,
      enquiryDetails,
      majorEquipments,
      enquirySource,
      fpr,
      mailId,
      contactCountryCode: normalizedCC,
      contactNumber,
      currentStatus: currentStatus || 'Costing',
      offerSubmittedDate: normalizedOfferDate,
      poNumber: poNumber || '',
      expectedDateOfDispatch: normalizedExpectedDispatchDate,
      projectEngineer: projectEngineer || '',
      followUpComments,
      createdBy: req.user.username
    });
    return res.status(201).json(savedEnquiry);
  } catch (error) {
    console.error('Error creating enquiry:', error);
    return res.status(400).json({ message: 'Failed to create enquiry', error: error.message });
  }
});

// POST import enquiries from Excel/CSV - Admin and General
router.post('/enquiries/import', authenticateToken, requireActiveRole, async (req, res) => {
  const { enquiries } = req.body;
  if (!enquiries || !Array.isArray(enquiries)) {
    return res.status(400).json({ message: 'Invalid payload: enquiries must be an array.' });
  }

  let importedCount = 0;
  let skippedCount = 0;
  const skippedItems = [];

  try {
    for (const item of enquiries) {
      let normalizedCC = (item.contactCountryCode || '').trim();
      if (normalizedCC && !normalizedCC.startsWith('+')) {
        normalizedCC = '+' + normalizedCC;
      }
      item.contactCountryCode = normalizedCC;

      if (!item.date || item.date.trim() === "") {
        item.date = "-";
      }
      if (!item.expectedDateOfDispatch || item.expectedDateOfDispatch.trim() === "") {
        item.expectedDateOfDispatch = "-";
      }
      if (!item.projectEngineer || item.projectEngineer.trim() === "") {
        item.projectEngineer = "-";
      }
      if (!item.clientName || item.clientName.trim() === "") {
        item.clientName = "-";
      }
      if (!item.companyName || item.companyName.trim() === "") {
        item.companyName = "-";
      }
      if (!item.enquiryDetails || item.enquiryDetails.trim() === "") {
        item.enquiryDetails = "-";
      }
      if (!item.enquirySource || item.enquirySource.trim() === "") {
        item.enquirySource = "-";
      }
      if (!item.majorEquipments || item.majorEquipments.trim() === "") {
        item.majorEquipments = "-";
      }
      if (!item.mailId || item.mailId.trim() === "") {
        item.mailId = "-";
      }
      if (!item.contactCountryCode || item.contactCountryCode.trim() === "") {
        item.contactCountryCode = "+91";
      }
      if (!item.contactNumber || item.contactNumber.trim() === "") {
        item.contactNumber = "-";
      }
      item.currentStatus = mapStatus(item.currentStatus);

      // 2. Duplicate checking (compatible with db.js find sort wrapper)
      let duplicateList = [];
      if (item.quotationNumber && item.quotationNumber.trim()) {
        duplicateList = await Enquiry.find({ 
          quotationNumber: { $regex: `^${item.quotationNumber.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } 
        }).sort({ createdAt: -1 });
      }
      if (duplicateList.length === 0) {
        const potential = await Enquiry.find({
          companyName: { $regex: `^${item.companyName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' },
          clientName: { $regex: `^${item.clientName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' }
        }).sort({ createdAt: -1 });

        const matched = potential.find(p => isDuplicate(p, item));
        if (matched) {
          duplicateList = [matched];
        }
      }

      if (duplicateList.length > 0) {
        skippedCount++;
        skippedItems.push({ item, reason: 'Duplicate entry' });
        continue;
      }

      const normalizedDate = normalizeDate(item.date);
      const normalizedOfferDate = normalizeDate(item.offerSubmittedDate);
      const normalizedExpectedDispatchDate = normalizeDate(item.expectedDateOfDispatch);
      let normalizedMilestones = (item.milestones || []).map(m => ({
        ...m,
        startDate: normalizeDate(m.startDate),
        endDate: normalizeDate(m.endDate),
        actualEndDate: normalizeDate(m.actualEndDate)
      }));
      normalizedMilestones = ensureMilestonePercentages(normalizedMilestones);

      // 3. Create entry
      await Enquiry.create({
        date: normalizedDate,
        quotationNumber: item.quotationNumber || '',
        clientName: item.clientName,
        companyName: item.companyName,
        enquiryDetails: item.enquiryDetails,
        majorEquipments: item.majorEquipments,
        enquirySource: item.enquirySource,
        fpr: item.fpr || '',
        mailId: item.mailId,
        contactCountryCode: item.contactCountryCode,
        contactNumber: item.contactNumber,
        currentStatus: item.currentStatus || 'Costing',
        offerSubmittedDate: normalizedOfferDate,
        poNumber: item.poNumber || '',
        expectedDateOfDispatch: normalizedExpectedDispatchDate,
        projectEngineer: item.projectEngineer || '',
        followUpComments: item.followUpComments || '',
        milestones: normalizedMilestones,
        createdBy: req.user.username
      });
      importedCount++;
    }

    return res.json({
      message: 'Import completed',
      imported: importedCount,
      skipped: skippedCount,
      skippedItems
    });
  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({ message: 'Internal server error during import', error: error.message });
  }
});

// PUT update enquiry - Admin and General
router.put('/enquiries/:id', authenticateToken, requireActiveRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { sendClientEmail, sendFprEmail, ...updateData } = req.body;

    if (updateData.contactCountryCode !== undefined) {
      let cc = (updateData.contactCountryCode || '').trim();
      if (cc && !cc.startsWith('+')) {
        cc = '+' + cc;
      }
      updateData.contactCountryCode = cc;
    }

    if (updateData.date !== undefined) {
      updateData.date = normalizeDate(updateData.date);
    }
    if (updateData.offerSubmittedDate !== undefined) {
      updateData.offerSubmittedDate = normalizeDate(updateData.offerSubmittedDate);
    }
    if (updateData.expectedDateOfDispatch !== undefined) {
      updateData.expectedDateOfDispatch = normalizeDate(updateData.expectedDateOfDispatch);
    }
    if (updateData.milestones !== undefined && Array.isArray(updateData.milestones)) {
      updateData.milestones = updateData.milestones.map(m => ({
        ...m,
        startDate: normalizeDate(m.startDate),
        endDate: normalizeDate(m.endDate),
        actualEndDate: normalizeDate(m.actualEndDate)
      }));
      updateData.milestones = ensureMilestonePercentages(updateData.milestones);
    }

    console.log('PUT Update Data:', JSON.stringify(updateData, null, 2));

    const existing = await Enquiry.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    const hasAccess = await userHasEnquiryAccess(req.user, existing);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Forbidden: You do not have access to this enquiry' });
    }

    const currentStatus = updateData.currentStatus !== undefined ? updateData.currentStatus : existing.currentStatus;
    const quotationNumber = updateData.quotationNumber !== undefined ? updateData.quotationNumber : existing.quotationNumber;
    const poNumber = updateData.poNumber !== undefined ? updateData.poNumber : existing.poNumber;
    const expectedDateOfDispatch = updateData.expectedDateOfDispatch !== undefined ? updateData.expectedDateOfDispatch : existing.expectedDateOfDispatch;
    const projectEngineer = updateData.projectEngineer !== undefined ? updateData.projectEngineer : existing.projectEngineer;

    if (currentStatus === 'Quotation Submitted' && (!quotationNumber || !quotationNumber.trim())) {
      return res.status(400).json({ message: 'Please Enter the Quotation Number' });
    }
    if (currentStatus === 'Confirmed' && (!poNumber || !poNumber.trim())) {
      return res.status(400).json({ message: 'Please Enter the PO Number' });
    }
    if (currentStatus === 'Confirmed' && (!expectedDateOfDispatch || !expectedDateOfDispatch.trim() || expectedDateOfDispatch === '-')) {
      return res.status(400).json({ message: 'Please Enter the Expected Date Of Dispatch' });
    }
    if (currentStatus === 'Confirmed' && (!projectEngineer || !projectEngineer.trim() || projectEngineer === '-')) {
      return res.status(400).json({ message: 'Please select a Project Engineer' });
    }

    // Check duplicates before update
    const targetQuotation = updateData.quotationNumber !== undefined ? updateData.quotationNumber : existing.quotationNumber;
    const targetCompanyName = updateData.companyName !== undefined ? updateData.companyName : existing.companyName;
    const targetClientName = updateData.clientName !== undefined ? updateData.clientName : existing.clientName;
    const targetContactNumber = updateData.contactNumber !== undefined ? updateData.contactNumber : existing.contactNumber;
    const targetMailId = updateData.mailId !== undefined ? updateData.mailId : existing.mailId;
    const targetMajorEquipments = updateData.majorEquipments !== undefined ? updateData.majorEquipments : existing.majorEquipments;

    let updateDuplicateList = [];
    if (targetQuotation && targetQuotation.trim()) {
      updateDuplicateList = await Enquiry.find({ 
        _id: { $ne: id },
        quotationNumber: { $regex: `^${targetQuotation.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } 
      }).sort({ createdAt: -1 });
    }
    if (updateDuplicateList.length === 0) {
      const potential = await Enquiry.find({
        _id: { $ne: id },
        companyName: { $regex: `^${targetCompanyName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' },
        clientName: { $regex: `^${targetClientName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' }
      }).sort({ createdAt: -1 });

      const newEnqObj = { 
        clientName: targetClientName, 
        companyName: targetCompanyName, 
        contactNumber: targetContactNumber, 
        mailId: targetMailId, 
        majorEquipments: targetMajorEquipments 
      };
      const matched = potential.find(p => isDuplicate(p, newEnqObj));
      if (matched) {
        updateDuplicateList = [matched];
      }
    }

    if (updateDuplicateList.length > 0) {
      return res.status(400).json({ message: 'Cannot update: Duplicate enquiry already exists' });
    }

    // Detect milestone changes for FPR email notification
    let milestonesToNotify = [];
    let fprMap = {};
    if (updateData.milestones !== undefined && Array.isArray(updateData.milestones)) {
      const oldMilestones = existing.milestones || [];
      const newMilestones = updateData.milestones;

      for (let i = 0; i < newMilestones.length; i++) {
        const sub = newMilestones[i];
        if (!sub.fpr || !sub.fpr.trim()) {
          continue;
        }

        const existingMilestone = oldMilestones[i];
        if (!existingMilestone) {
          milestonesToNotify.push(sub);
        } else {
          const existingFpr = existingMilestone.fpr ? existingMilestone.fpr.trim() : '';
          const subFpr = sub.fpr.trim();

          if (existingFpr !== subFpr) {
            milestonesToNotify.push(sub);
          } else {
            const nameChanged = (existingMilestone.name || '').trim() !== (sub.name || '').trim();
            const startChanged = normalizeDate(existingMilestone.startDate) !== normalizeDate(sub.startDate);
            const endChanged = normalizeDate(existingMilestone.endDate) !== normalizeDate(sub.endDate);

            if (nameChanged || startChanged || endChanged) {
              milestonesToNotify.push(sub);
            }
          }
        }
      }

      if (milestonesToNotify.length > 0) {
        try {
          const fprsList = await Fpr.find().sort({ name: 1 });
          fprsList.forEach(f => {
            if (f.name && f.email) {
              fprMap[f.name.trim().toLowerCase()] = f.email.trim();
            }
          });
        } catch (err) {
          console.error('Error fetching FPR list for milestone notification:', err);
        }
      }
    }

    // Detect milestone completion changes for Client email notification
    let clientCompletedMilestones = [];
    if (sendClientEmail === true && updateData.milestones !== undefined && Array.isArray(updateData.milestones)) {
      const oldMilestones = existing.milestones || [];
      const newMilestones = updateData.milestones;

      for (let i = 0; i < newMilestones.length; i++) {
        const sub = newMilestones[i];
        if (sub.status === 'Completed') {
          const existingMilestone = oldMilestones[i];
          if (!existingMilestone || existingMilestone.status !== 'Completed') {
            clientCompletedMilestones.push(sub);
          }
        }
      }
    }

    // Detect if status changed to Confirmed - Disabled sending confirmation email automatically
    let sendOrderConfirmedEmail = false;

    const updatedEnquiry = await Enquiry.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedEnquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    if (sendFprEmail === true && milestonesToNotify.length > 0) {
      const poNumber = updateData.poNumber || existing.poNumber || '-';
      const companyName = updateData.companyName || existing.companyName || '-';
      const clientName = updateData.clientName || existing.clientName || '-';
      const projectEngineerName = updateData.projectEngineer || existing.projectEngineer || '';

      setImmediate(async () => {
        let peEmail = '';
        if (projectEngineerName && projectEngineerName !== '-') {
          try {
            const peObj = await ProjectEngineer.findOne({
              name: { $regex: `^${projectEngineerName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' }
            });
            if (peObj) {
              peEmail = peObj.email;
            }
          } catch (peErr) {
            console.error('Error fetching Project Engineer details for milestone notification:', peErr);
          }
        }

        const fromHeader = peEmail 
          ? `"${projectEngineerName}" <${process.env.SMTP_USER || 'aarti.j@semcogroups.com'}>`
          : `"SEMCO Portal" <${process.env.SMTP_USER || 'aarti.j@semcogroups.com'}>`;

        for (const m of milestonesToNotify) {
          const fprName = m.fpr.trim();
          const fprEmail = fprMap[fprName.toLowerCase()];
          if (!fprEmail) {
            console.log(`[Milestone Email] No email registered for FPR: "${fprName}". Skipping notification.`);
            continue;
          }

          try {
            const displayStart = m.startDate || 'Not specified';
            const displayEnd = m.endDate || 'Not specified';

            const mailOptions = {
              from: fromHeader,
              to: fprEmail,
              replyTo: peEmail || undefined,
              subject: `Milestone Assignment: ${m.name} (PO: ${poNumber})`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff;">
                  <div style="text-align: center; margin-bottom: 24px;">
                    <h2 style="color: #10b981; margin: 0;">SEMCO Groups</h2>
                    <span style="color: #777777; font-size: 0.9rem;">Milestone Assignment Notification</span>
                  </div>
                  <hr style="border: 0; border-top: 1px solid #eeeeee;" />
                  <h3 style="color: #333333; margin-top: 24px;">Hello ${fprName},</h3>
                  <p style="color: #555555; font-size: 1rem; line-height: 1.6;">
                    You have been assigned a milestone on the Confirmed Enquiry. Please find the assignment details below:
                  </p>
                  
                  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-weight: 600; width: 140px;">Milestone Name:</td>
                        <td style="padding: 6px 0; color: #111827; font-weight: bold;">${m.name}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Start Date:</td>
                        <td style="padding: 6px 0; color: #111827;">${displayStart}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">End Date:</td>
                        <td style="padding: 6px 0; color: #111827;">${displayEnd}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">PO Number:</td>
                        <td style="padding: 6px 0; color: #111827; font-weight: bold;">${poNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Company:</td>
                        <td style="padding: 6px 0; color: #111827;">${companyName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Client Name:</td>
                        <td style="padding: 6px 0; color: #111827;">${clientName}</td>
                      </tr>
                    </table>
                  </div>

                  <p style="color: #555555; font-size: 1rem; line-height: 1.6;">
                    Please log in to the SEMCO Enquiry Management Portal to update the status and progress of this milestone.
                  </p>
                  
                  <p style="color: #999999; font-size: 0.8rem; margin-top: 32px; text-align: center;">
                    &copy; 2026 SEMCO Groups. All rights reserved.
                  </p>
                </div>
              `
            };

            await transporter.sendMail(mailOptions);
            console.log(`[Milestone Email] Notification email sent to ${fprName} (${fprEmail}) for milestone "${m.name}".`);
          } catch (mailErr) {
            console.error(`[Milestone Email] Failed to send email to ${fprName} (${fprEmail}):`, mailErr);
          }
        }
      });
    }

    if (clientCompletedMilestones.length > 0) {
      const clientEmail = updateData.mailId || existing.mailId;
      const poNumber = updateData.poNumber || existing.poNumber || '-';
      const companyName = updateData.companyName || existing.companyName || '-';
      const clientName = updateData.clientName || existing.clientName || 'Client';
      const projectEngineerName = updateData.projectEngineer || existing.projectEngineer || '';

      if (clientEmail && clientEmail.trim()) {
        setImmediate(async () => {
          try {
            let peEmail = '';
            let pePhone = '';
            let peName = projectEngineerName;
            if (projectEngineerName && projectEngineerName !== '-') {
              try {
                const peObj = await ProjectEngineer.findOne({
                  name: { $regex: `^${projectEngineerName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' }
                });
                if (peObj) {
                  peEmail = peObj.email || '';
                  pePhone = peObj.contactNumber || '';
                  peName = peObj.name || projectEngineerName;
                }
              } catch (peErr) {
                console.error('Error fetching Project Engineer for client milestone email:', peErr);
              }
            }

            const fromHeader = peEmail 
              ? `"${peName}" <${process.env.SMTP_USER || 'aarti.j@semcogroups.com'}>`
              : `"SEMCO Portal" <${process.env.SMTP_USER || 'aarti.j@semcogroups.com'}>`;

            const milestoneListHtml = clientCompletedMilestones.map(m => `
              <li style="margin: 8px 0; color: #111827;">
                <strong>${m.name}</strong> (Completed Date: ${m.actualEndDate || new Date().toISOString().split('T')[0]})
              </li>
            `).join('');

            const completedPercentage = updatedEnquiry.milestones.reduce((acc, m) => {
              if (m.status === 'Completed') {
                return acc + (m.percentage || 0);
              }
              return acc;
            }, 0);

            const mailOptions = {
              from: fromHeader,
              to: clientEmail.trim(),
              replyTo: peEmail || undefined,
              subject: `Order Status Update: Milestone Completed (PO: ${poNumber})`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff;">
                  <div style="text-align: center; margin-bottom: 24px;">
                    <h2 style="color: #10b981; margin: 0;">SEMCO Groups</h2>
                    <span style="color: #777777; font-size: 0.9rem;">Order Progress Update</span>
                  </div>
                  <hr style="border: 0; border-top: 1px solid #eeeeee;" />
                  <h3 style="color: #333333; margin-top: 24px;">Dear ${clientName},</h3>
                  <p style="color: #555555; font-size: 1rem; line-height: 1.6;">
                    We are pleased to inform you that the status of your order has changed. The following milestone(s) have been successfully completed:
                  </p>
                  
                  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0; color: #6b7280; font-weight: bold;">Completed Milestone(s):</p>
                    <ul style="margin: 0; padding-left: 20px;">
                      ${milestoneListHtml}
                    </ul>
                    
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
                      <tr>
                        <td style="font-size: 0.95rem; font-weight: bold; color: #4b5563; padding-bottom: 4px;">Overall Completion Progress:</td>
                        <td style="font-size: 0.95rem; font-weight: 800; color: #10b981; text-align: right; padding-bottom: 4px;">${completedPercentage}%</td>
                      </tr>
                    </table>
                    <div style="width: 100%; background-color: #e5e7eb; border-radius: 8px; height: 16px; overflow: hidden; margin-bottom: 16px; border: 1px solid #d1d5db;">
                      <div style="width: ${completedPercentage}%; background-color: #10b981; height: 100%; border-radius: 8px;"></div>
                    </div>

                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 12px 0;" />
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-weight: 600; width: 120px;">PO Number:</td>
                        <td style="padding: 4px 0; color: #111827; font-weight: bold;">${poNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Company:</td>
                        <td style="padding: 4px 0; color: #111827;">${companyName}</td>
                      </tr>
                    </table>
                  </div>

                  <p style="color: #555555; font-size: 1rem; line-height: 1.6;">
                    If you have any questions or require further details, please do not hesitate to contact us.
                  </p>

                  ${peName && peName !== '-' ? `
                    <div style="margin-top: 32px; border-top: 1px solid #eeeeee; padding-top: 16px; font-size: 0.9rem; color: #4b5563;">
                      <p style="margin: 0; font-weight: bold; color: #111827;">Thanks & Regards,</p>
                      <p style="margin: 4px 0 0 0; font-weight: bold; color: #3b82f6;">${peName}</p>
                      <p style="margin: 2px 0 0 0; color: #6b7280; font-size: 0.85rem;">Project Engineer</p>
                      <p style="margin: 2px 0 0 0; color: #6b7280; font-size: 0.85rem;">Email: <a href="mailto:${peEmail || 'aarti.j@semcogroups.com'}" style="color: #3b82f6; text-decoration: none;">${peEmail || '-'}</a></p>
                      ${pePhone ? `<p style="margin: 2px 0 0 0; color: #6b7280; font-size: 0.85rem;">Contact: ${pePhone}</p>` : ''}
                      <p style="margin: 4px 0 0 0; font-weight: bold; color: #10b981; font-size: 0.85rem;">SEMCO Groups</p>
                    </div>
                  ` : ''}
                  
                  <p style="color: #999999; font-size: 0.8rem; margin-top: 32px; text-align: center;">
                    Thank you for your business! <br />
                    &copy; 2026 SEMCO Groups. All rights reserved.
                  </p>
                </div>
              `
            };

            await transporter.sendMail(mailOptions);
            console.log(`[Client Email] Order progress update email sent successfully to client: "${clientEmail}" for PO: "${poNumber}".`);
          } catch (mailErr) {
            console.error(`[Client Email] Failed to send update email to client "${clientEmail}":`, mailErr);
          }
        });
      } else {
        console.log(`[Client Email] No client email (mailId) found on enquiry. Skipping client notification.`);
      }
    }

    if (sendOrderConfirmedEmail) {
      const clientEmail = updateData.mailId || existing.mailId;
      const clientName = updateData.clientName || existing.clientName || 'Client';
      const poNumber = updateData.poNumber || existing.poNumber || '-';
      const companyName = updateData.companyName || existing.companyName || '-';
      const majorEquipments = updateData.majorEquipments || existing.majorEquipments || '-';
      const expectedDateOfDispatch = updateData.expectedDateOfDispatch || existing.expectedDateOfDispatch || '-';

      if (clientEmail && clientEmail.trim()) {
        setImmediate(async () => {
          try {
            const peName = updateData.projectEngineer || existing.projectEngineer || '-';
            let peEmail = '-';
            let pePhone = '-';
            if (peName && peName !== '-') {
              const peDetails = await ProjectEngineer.findOne({ name: peName });
              if (peDetails) {
                peEmail = peDetails.email || '-';
                pePhone = peDetails.contactNumber || '-';
              }
            }

            const mailOptions = {
              from: `"SEMCO Portal" <${process.env.SMTP_USER || 'aarti.j@semcogroups.com'}>`,
              to: clientEmail.trim(),
              subject: `Order Confirmed - PO: ${poNumber}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff;">
                  <div style="text-align: center; margin-bottom: 24px;">
                    <h2 style="color: #10b981; margin: 0;">SEMCO Groups</h2>
                    <span style="color: #777777; font-size: 0.9rem;">Order Confirmation</span>
                  </div>
                  <hr style="border: 0; border-top: 1px solid #eeeeee;" />
                  <h3 style="color: #333333; margin-top: 24px;">Dear ${clientName},</h3>
                  <p style="color: #555555; font-size: 1rem; line-height: 1.6;">
                    We are pleased to inform you that your order has been successfully confirmed. Thank you for choosing SEMCO Groups. We appreciate your business and look forward to working with you!
                  </p>
                  
                  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0; color: #10b981; font-weight: bold;">Order Details:</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-weight: 600; width: 140px;">PO Number:</td>
                        <td style="padding: 4px 0; color: #111827; font-weight: bold;">${poNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Company:</td>
                        <td style="padding: 4px 0; color: #111827;">${companyName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Major Equipments:</td>
                        <td style="padding: 4px 0; color: #111827;">${majorEquipments}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Expected Dispatch Date:</td>
                        <td style="padding: 4px 0; color: #111827; font-weight: bold;">${expectedDateOfDispatch}</td>
                      </tr>
                    </table>

                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 12px 0;" />
                    <p style="margin: 0 0 10px 0; color: #10b981; font-weight: bold;">Assigned Project Engineer:</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-weight: 600; width: 140px;">Name:</td>
                        <td style="padding: 4px 0; color: #111827; font-weight: bold;">${peName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Email:</td>
                        <td style="padding: 4px 0; color: #111827;">${peEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Contact Number:</td>
                        <td style="padding: 4px 0; color: #111827;">${pePhone}</td>
                      </tr>
                    </table>
                  </div>

                  <p style="color: #555555; font-size: 1rem; line-height: 1.6;">
                    Our team will keep you updated as progress is made on the project milestones. If you have any immediate questions, please contact your follow-up representative.
                  </p>
                  
                  <p style="color: #999999; font-size: 0.8rem; margin-top: 32px; text-align: center;">
                    Thank you once again for your business! <br />
                    &copy; 2026 SEMCO Groups. All rights reserved.
                  </p>
                </div>
              `
            };

            await transporter.sendMail(mailOptions);
            console.log(`[Order Confirmation Email] Confirmation email sent successfully to client: "${clientEmail}" for PO: "${poNumber}".`);
          } catch (mailErr) {
            console.error(`[Order Confirmation Email] Failed to send email to client "${clientEmail}":`, mailErr);
          }
        });
      } else {
        console.log(`[Order Confirmation Email] No client email (mailId) found on enquiry. Skipping confirmation notification.`);
      }
    }

    return res.json(updatedEnquiry);
  } catch (error) {
    console.error('Error updating enquiry:', error);
    return res.status(400).json({ message: 'Failed to update enquiry', error: error.message });
  }
});

// DELETE enquiry - Admin and General (Moves data to Bin Database)
router.delete('/enquiries/:id', authenticateToken, requireActiveRole, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Enquiry.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    const hasAccess = await userHasEnquiryAccess(req.user, existing);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Forbidden: You do not have access to this enquiry' });
    }
    
    // 1. Delete from Enquiry database first
    const deletedEnquiry = await Enquiry.findByIdAndDelete(id);
    if (!deletedEnquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    // Convert document to plain object
    const plainData = deletedEnquiry.toObject ? deletedEnquiry.toObject() : deletedEnquiry;
    
    // Clean Mongoose fields if present before saving
    const { _id, __v, ...pureData } = plainData;

    // 2. Create in BinEnquiry collection with original ID
    await BinEnquiry.create({
      _id: id,
      ...pureData
    });

    return res.json({ message: 'Enquiry successfully moved to bin', id });
  } catch (error) {
    console.error('Error deleting enquiry (moving to bin):', error);
    return res.status(500).json({ message: 'Failed to delete enquiry' });
  }
});

// GET all enquiries in bin - Accessible to both Admin and General
router.get('/bin', authenticateToken, requireActiveRole, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'General') {
      const pe = await ProjectEngineer.findOne({
        email: { $regex: `^${req.user.username.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' }
      });
      if (pe) {
        query = {
          $or: [
            { createdBy: req.user.username },
            { projectEngineer: pe.name }
          ]
        };
      } else {
        query = { createdBy: req.user.username };
      }
    }
    const binEnquiries = await BinEnquiry.find(query).sort({ updatedAt: -1 });
    return res.json(binEnquiries);
  } catch (error) {
    console.error('Error fetching bin enquiries:', error);
    return res.status(500).json({ message: 'Error fetching bin' });
  }
});

// POST recover enquiry from bin - Admin and General
router.post('/bin/:id/recover', authenticateToken, requireActiveRole, async (req, res) => {
  try {
    const { id } = req.params;

    const bEnq = await BinEnquiry.findById(id);
    if (!bEnq) {
      return res.status(404).json({ message: 'Enquiry not found in bin' });
    }

    const hasAccess = await userHasEnquiryAccess(req.user, bEnq);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Forbidden: You do not have access to this enquiry' });
    }

    // Check duplicates before recovery
    let duplicateList = [];
    if (bEnq.quotationNumber && bEnq.quotationNumber.trim()) {
      duplicateList = await Enquiry.find({ 
        quotationNumber: { $regex: `^${bEnq.quotationNumber.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } 
      }).sort({ createdAt: -1 });
    }
    if (duplicateList.length === 0) {
      const potential = await Enquiry.find({
        companyName: { $regex: `^${bEnq.companyName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' },
        clientName: { $regex: `^${bEnq.clientName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' }
      }).sort({ createdAt: -1 });

      const matched = potential.find(p => isDuplicate(p, bEnq));
      if (matched) {
        duplicateList = [matched];
      }
    }

    if (duplicateList.length > 0) {
      return res.status(400).json({ message: 'Cannot restore: Duplicate enquiry already exists in the active database' });
    }

    // 1. Find and delete from BinEnquiry
    await BinEnquiry.findByIdAndDelete(id);

    // Convert document to plain object
    const plainData = bEnq.toObject ? bEnq.toObject() : bEnq;
    const { _id, __v, ...pureData } = plainData;

    // 2. Move back to Enquiry collection
    const restored = await Enquiry.create({
      _id: id,
      ...pureData
    });

    // Run cleanDuplicateEnquiries immediately to guarantee database is clean
    await cleanDuplicateEnquiries();

    return res.json({ message: 'Enquiry successfully restored', enquiry: restored });
  } catch (error) {
    console.error('Error recovering enquiry:', error);
    return res.status(500).json({ message: 'Failed to recover enquiry' });
  }
});

// DELETE permanently delete all enquiries from bin - Admin and General
router.delete('/bin', authenticateToken, requireActiveRole, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'General') {
      const pe = await ProjectEngineer.findOne({
        email: { $regex: `^${req.user.username.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' }
      });
      if (pe) {
        query = {
          $or: [
            { createdBy: req.user.username },
            { projectEngineer: pe.name }
          ]
        };
      } else {
        query = { createdBy: req.user.username };
      }
    }
    const result = await BinEnquiry.deleteMany(query);
    return res.json({ message: 'All enquiries permanently deleted from bin', deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Error clearing recycle bin:', error);
    return res.status(500).json({ message: 'Failed to clear recycle bin' });
  }
});

// DELETE permanently delete enquiry from bin - Admin and General
router.delete('/bin/:id', authenticateToken, requireActiveRole, async (req, res) => {
  try {
    const { id } = req.params;

    const bEnq = await BinEnquiry.findById(id);
    if (!bEnq) {
      return res.status(404).json({ message: 'Enquiry not found in bin' });
    }

    const hasAccess = await userHasEnquiryAccess(req.user, bEnq);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Forbidden: You do not have access to this enquiry' });
    }

    await BinEnquiry.findByIdAndDelete(id);

    return res.json({ message: 'Enquiry permanently deleted' });
  } catch (error) {
    console.error('Error permanently deleting enquiry:', error);
    return res.status(500).json({ message: 'Failed to permanently delete enquiry' });
  }
});

// Equipment management endpoints
// GET /api/equipments - fetch all equipments sorted by name
router.get('/equipments', authenticateToken, requireActiveRole, async (req, res) => {
  try {
    const list = await Equipment.find().sort({ name: 1 });
    res.json(list);
  } catch (error) {
    console.error('Error fetching equipments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/equipments - add a new equipment (Admin only)
router.post('/equipments', authenticateToken, requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'Equipment name is required' });
  }
  const trimmedName = name.trim();
  try {
    const existing = await Equipment.findOne({ name: { $regex: `^${trimmedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } });
    if (existing) {
      return res.status(400).json({ message: 'Equipment already exists' });
    }
    const newEquip = await Equipment.create({ name: trimmedName });
    res.status(201).json(newEquip);
  } catch (error) {
    console.error('Error adding equipment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/equipments/:id - delete an equipment (Admin only)
router.delete('/equipments/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Equipment.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Equipment not found' });
    }
    res.json({ message: 'Equipment deleted successfully', deleted });
  } catch (error) {
    console.error('Error deleting equipment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// FPR management endpoints
// GET /api/fprs - fetch all FPRs sorted by name
router.get('/fprs', authenticateToken, requireActiveRole, async (req, res) => {
  try {
    const list = await Fpr.find().sort({ name: 1 });
    res.json(list);
  } catch (error) {
    console.error('Error fetching FPRs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/fprs - add a new FPR (Admin only)
router.post('/fprs', authenticateToken, requireAdmin, async (req, res) => {
  const { name, email } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'FPR name is required' });
  }
  const trimmedName = name.trim();
  const trimmedEmail = email ? email.trim() : '';

  try {
    const existing = await Fpr.findOne({ name: { $regex: `^${trimmedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } });
    if (existing) {
      return res.status(400).json({ message: 'FPR already exists' });
    }
    const newFpr = await Fpr.create({ name: trimmedName, email: trimmedEmail });
    res.status(201).json(newFpr);
  } catch (error) {
    console.error('Error adding FPR:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/fprs/:id - delete an FPR (Admin only)
router.delete('/fprs/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Fpr.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'FPR not found' });
    }
    res.json({ message: 'FPR deleted successfully', deleted });
  } catch (error) {
    console.error('Error deleting FPR:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Project Engineer management endpoints
// GET /api/project-engineers - fetch all Project Engineers sorted by name
router.get('/project-engineers', authenticateToken, requireActiveRole, async (req, res) => {
  try {
    const list = await ProjectEngineer.find().sort({ name: 1 });
    res.json(list);
  } catch (error) {
    console.error('Error fetching Project Engineers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/project-engineers - add a new Project Engineer (Admin only)
router.post('/project-engineers', authenticateToken, requireAdmin, async (req, res) => {
  const { name, email, contactNumber } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'Project Engineer name is required' });
  }
  const trimmedName = name.trim();
  const trimmedEmail = email ? email.trim() : '';
  const trimmedContactNumber = contactNumber ? contactNumber.trim() : '';

  try {
    const existing = await ProjectEngineer.findOne({ name: { $regex: `^${trimmedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } });
    if (existing) {
      return res.status(400).json({ message: 'Project Engineer already exists' });
    }
    const newPe = await ProjectEngineer.create({ name: trimmedName, email: trimmedEmail, contactNumber: trimmedContactNumber });
    res.status(201).json(newPe);
  } catch (error) {
    console.error('Error adding Project Engineer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/project-engineers/:id - delete a Project Engineer (Admin only)
router.delete('/project-engineers/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await ProjectEngineer.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Project Engineer not found' });
    }
    res.json({ message: 'Project Engineer deleted successfully', deleted });
  } catch (error) {
    console.error('Error deleting Project Engineer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// User management endpoints (Admin only)
// GET /api/users - Fetch all users sanitized
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({});
    const sanitizedUsers = users.map(u => ({
      _id: u._id,
      username: u.username,
      name: u.name || '',
      role: u.role || '',
      isEmailVerified: u.isEmailVerified
    }));
    return res.json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/users/:id/role - Update user role
router.put('/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (role !== 'Admin' && role !== 'General') {
    return res.status(400).json({ message: 'Invalid role' });
  }

  try {
    // Prevent self role changes
    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }

    const updated = await User.updateOne({ _id: id }, { role });
    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error updating user role:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/users/:id - Delete a user
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Prevent self account deletion
    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/enquiries/:id/send-progress-email - Send progress report to client
router.post('/enquiries/:id/send-progress-email', authenticateToken, requireActiveRole, async (req, res) => {
  const { id } = req.params;
  const { to, cc, subject, message, includeGantt, images } = req.body;

  if (!to || !to.trim()) {
    return res.status(400).json({ message: 'Client email recipient (To) is required.' });
  }

  try {
    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    // Verify access
    const hasAccess = await userHasEnquiryAccess(req.user, enquiry);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Forbidden: You do not have access to this enquiry' });
    }

    // Resolve Project Engineer details
    const projectEngineerName = enquiry.projectEngineer || '';
    let peEmail = '';
    let pePhone = '';
    let peName = projectEngineerName;
    if (projectEngineerName && projectEngineerName !== '-') {
      try {
        const peObj = await ProjectEngineer.findOne({
          name: { $regex: `^${projectEngineerName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' }
        });
        if (peObj) {
          peEmail = peObj.email || '';
          pePhone = peObj.contactNumber || '';
          peName = peObj.name || projectEngineerName;
        }
      } catch (peErr) {
        console.error('Error fetching Project Engineer for progress email:', peErr);
      }
    }

    const fromHeader = peEmail 
      ? `"${peName}" <${process.env.SMTP_USER || 'aarti.j@semcogroups.com'}>`
      : `"SEMCO Portal" <${process.env.SMTP_USER || 'aarti.j@semcogroups.com'}>`;

    // 1. Prepare HTML Gantt Table if requested
    let ganttHtml = '';
    if (includeGantt && enquiry.milestones && enquiry.milestones.length > 0) {
      // Find milestone dates range
      const parseDate = (dStr) => {
        if (!dStr || dStr.trim() === '' || dStr === '-') return null;
        const d = new Date(dStr);
        return isNaN(d.getTime()) ? null : d;
      };

      const timed = enquiry.milestones.map(mDoc => {
        const m = mDoc.toObject ? mDoc.toObject() : mDoc;
        const start = parseDate(m.startDate);
        const end = parseDate(m.endDate);
        if (start && end) {
          return { ...m, start: start < end ? start : end, end: start < end ? end : start, hasDates: true };
        }
        return { ...m, hasDates: false };
      });

      const valid = timed.filter(m => m.hasDates);
      if (valid.length > 0) {
        const minDate = new Date(Math.min(...valid.map(m => m.start.getTime())));
        const maxDate = new Date(Math.max(...valid.map(m => m.end.getTime())));
        let totalDuration = maxDate.getTime() - minDate.getTime();
        if (totalDuration === 0) totalDuration = 24 * 60 * 60 * 1000;
        const durationDays = Math.ceil(totalDuration / (24 * 60 * 60 * 1000)) + 1;
        totalDuration = durationDays * 24 * 60 * 60 * 1000;

        const getStatusColor = (status) => {
          if (status === 'Completed') return '#10b981';
          if (status === 'In Progress') return '#3b82f6';
          return '#6b7280';
        };

        // Construct HTML Gantt chart
        const rowsHtml = timed.map(m => {
          if (m.hasDates) {
            const leftPercent = ((m.start.getTime() - minDate.getTime()) / totalDuration) * 100;
            let widthPercent = ((m.end.getTime() - m.start.getTime() + (24 * 60 * 60 * 1000)) / totalDuration) * 100;
            if (leftPercent + widthPercent > 100) widthPercent = 100 - leftPercent;
            if (widthPercent < 4) widthPercent = 4;
            const days = Math.ceil((m.end.getTime() - m.start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

            return `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px; font-weight: bold; font-size: 0.85rem; width: 180px; color: #111827;">${m.name}</td>
                <td style="padding: 8px; font-size: 0.8rem; width: 140px; color: #4b5563;">
                  ${m.startDate} to ${m.endDate}<br>
                  <span style="font-size: 0.72rem; color: #6b7280; font-weight: bold;">(${days} days)</span>
                </td>
                <td style="padding: 8px; font-size: 0.8rem; width: 100px; color: ${getStatusColor(m.status)}; font-weight: bold;">${m.status}</td>
                <td style="padding: 8px; position: relative;">
                  <div style="width: 100%; background-color: #f3f4f6; border-radius: 4px; height: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
                    <div style="margin-left: ${leftPercent}%; width: ${widthPercent}%; background-color: ${getStatusColor(m.status)}; height: 100%; border-radius: 4px;"></div>
                  </div>
                </td>
              </tr>
            `;
          } else {
            return `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px; font-weight: bold; font-size: 0.85rem; width: 180px; color: #111827;">${m.name}</td>
                <td style="padding: 8px; font-size: 0.8rem; width: 140px; color: #9ca3af; font-style: italic;">Dates not set</td>
                <td style="padding: 8px; font-size: 0.8rem; width: 100px; color: #9ca3af;">${m.status}</td>
                <td style="padding: 8px; font-size: 0.8rem; color: #9ca3af; font-style: italic;">Not scheduled</td>
              </tr>
            `;
          }
        }).join('');

        ganttHtml = `
          <div style="margin-top: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; font-family: Arial, sans-serif;">
            <div style="background-color: #f9fafb; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
              <h4 style="margin: 0; color: #111827; font-size: 1rem;">📋 Milestone Gantt Chart Timeline</h4>
            </div>
            <div style="padding: 8px; overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                  <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb; font-size: 0.8rem; text-transform: uppercase; color: #6b7280;">
                    <th style="padding: 8px;">Milestone</th>
                    <th style="padding: 8px;">Dates</th>
                    <th style="padding: 8px;">Status</th>
                    <th style="padding: 8px;">Timeline Visual</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }
    }

    // 2. Process image attachments
    const attachments = [];
    let imageBlocksHtml = '';

    if (images && Array.isArray(images)) {
      images.forEach((img, index) => {
        if (img.data && typeof img.data === 'string') {
          const match = img.data.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.*)$/);
          if (match) {
            const ext = match[1];
            const base64Data = match[2];
            const cid = `progress_img_${index}_${Date.now()}`;
            const buffer = Buffer.from(base64Data, 'base64');
            
            attachments.push({
              filename: img.name || `image_${index}.${ext}`,
              content: buffer,
              cid: cid
            });

            imageBlocksHtml += `
              <div style="margin-bottom: 20px; text-align: center;">
                <img src="cid:${cid}" style="max-width: 100%; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);" alt="${img.name || 'Progress Upload'}" />
                ${img.name ? `<div style="font-size: 0.8rem; color: #6b7280; margin-top: 4px; font-style: italic;">${img.name}</div>` : ''}
              </div>
            `;
          }
        }
      });
    }

    // 3. Construct Email Body HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #10b981; margin: 0;">SEMCO Groups</h2>
          <span style="color: #777777; font-size: 0.9rem;">Project Progress Update</span>
        </div>
        <hr style="border: 0; border-top: 1px solid #eeeeee;" />
        
        <!-- 1. Company and Project Engineer Details -->
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 10px; border: 1px solid #e5e7eb; margin-top: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; line-height: 1.5;">
            <tr>
              <td style="color: #6b7280; font-weight: bold; width: 180px; padding: 4px 0;">Company Name:</td>
              <td style="color: #111827; padding: 4px 0; font-weight: bold; font-size: 0.95rem;">${enquiry.companyName}</td>
            </tr>
            <tr>
              <td style="color: #6b7280; font-weight: bold; padding: 4px 0;">PO Number:</td>
              <td style="color: #111827; padding: 4px 0; font-weight: bold; font-size: 0.95rem;">${enquiry.poNumber || '-'}</td>
            </tr>
            ${peName && peName !== '-' ? `
              <tr>
                <td style="color: #6b7280; font-weight: bold; padding: 4px 0; vertical-align: top;">Project Engineer:</td>
                <td style="color: #111827; padding: 4px 0;">
                  <strong style="color: #3b82f6;">${peName}</strong><br />
                  <span style="font-size: 0.82rem; color: #6b7280;">Email: <a href="mailto:${peEmail || 'aarti.j@semcogroups.com'}" style="color: #3b82f6; text-decoration: none;">${peEmail || '-'}</a></span><br />
                  ${pePhone ? `<span style="font-size: 0.82rem; color: #6b7280;">Contact: ${pePhone}</span>` : ''}
                </td>
              </tr>
            ` : ''}
          </table>
        </div>

        <!-- 2. Project Remarks Section -->
        <div style="margin-top: 24px;">
          <h3 style="color: #374151; border-bottom: 2px solid #10b981; padding-bottom: 6px; margin: 0 0 12px 0; font-size: 1.1rem;">📝 Project Remarks</h3>
          <div style="color: #111827; font-size: 1rem; line-height: 1.6; white-space: pre-wrap; background: #ffffff; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px;">
            ${message ? message.replace(/\n/g, '<br>') : '<p style="color: #6b7280; font-style: italic; margin: 0;">No remarks provided.</p>'}
          </div>
        </div>

        <!-- 3. Gantt Chart Section -->
        ${ganttHtml}

        <!-- 4. Progress Photos Section -->
        ${imageBlocksHtml ? `
          <div style="margin-top: 28px;">
            <h3 style="color: #374151; border-bottom: 2px solid #10b981; padding-bottom: 6px; margin: 0 0 16px 0; font-size: 1.1rem;">📸 Progress Photos</h3>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 10px;">
              ${imageBlocksHtml}
            </div>
          </div>
        ` : ''}

        <!-- 5. Signature Block -->
        ${peName && peName !== '-' ? `
          <div style="margin-top: 36px; border-top: 1px solid #eeeeee; padding-top: 16px; font-size: 0.9rem; color: #4b5563;">
            <p style="margin: 0; font-weight: bold; color: #111827;">Thanks & Regards,</p>
            <p style="margin: 4px 0 0 0; font-weight: bold; color: #3b82f6;">${peName}</p>
            <p style="margin: 2px 0 0 0; color: #6b7280; font-size: 0.85rem;">Project Engineer</p>
            <p style="margin: 2px 0 0 0; color: #6b7280; font-size: 0.85rem;">Email: <a href="mailto:${peEmail || 'aarti.j@semcogroups.com'}" style="color: #3b82f6; text-decoration: none;">${peEmail || '-'}</a></p>
            ${pePhone ? `<p style="margin: 2px 0 0 0; color: #6b7280; font-size: 0.85rem;">Contact: ${pePhone}</p>` : ''}
            <p style="margin: 4px 0 0 0; font-weight: bold; color: #10b981; font-size: 0.85rem;">SEMCO Groups</p>
          </div>
        ` : ''}

        <p style="color: #999999; font-size: 0.8rem; margin-top: 32px; text-align: center;">
          &copy; 2026 SEMCO Groups. All rights reserved.
        </p>
      </div>
    `;

    // 4. Send email
    const mailOptions = {
      from: fromHeader,
      to: to.trim(),
      cc: cc ? cc.trim() : undefined,
      replyTo: peEmail || undefined,
      subject: subject || `Project Progress Update - PO: ${enquiry.poNumber || '-'}`,
      html: emailHtml,
      attachments: attachments
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Progress Report Email] Report sent successfully to "${to}" for PO: "${enquiry.poNumber || '-'}".`);

    return res.json({ message: 'Progress report email sent successfully!' });
  } catch (error) {
    console.error('Error sending progress report email:', error);
    return res.status(500).json({ message: 'Failed to send progress report email', error: error.message });
  }
});

// POST /api/enquiries/:id/send-custom-email - Send custom email to client with optional attachment
router.post('/enquiries/:id/send-custom-email', authenticateToken, requireActiveRole, async (req, res) => {
  const { id } = req.params;
  const { to, cc, subject, message, attachment } = req.body; // attachment: { filename, data } (base64 string)

  if (!subject || !subject.trim()) {
    return res.status(400).json({ message: 'Subject is required.' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ message: 'Message content is required.' });
  }

  try {
    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }

    const clientEmail = (to && to.trim()) ? to.trim() : (enquiry.mailId || '');
    if (!clientEmail || !clientEmail.trim()) {
      return res.status(400).json({ message: 'Client email recipient (To) is required.' });
    }

    // Verify access
    const hasAccess = await userHasEnquiryAccess(req.user, enquiry);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Forbidden: You do not have access to this enquiry' });
    }

    // Resolve Project Engineer details
    const projectEngineerName = enquiry.projectEngineer || '';
    let peEmail = '';
    let pePhone = '';
    let peName = projectEngineerName;
    if (projectEngineerName && projectEngineerName !== '-') {
      try {
        const peObj = await ProjectEngineer.findOne({
          name: { $regex: `^${projectEngineerName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' }
        });
        if (peObj) {
          peEmail = peObj.email || '';
          pePhone = peObj.contactNumber || '';
          peName = peObj.name || projectEngineerName;
        }
      } catch (peErr) {
        console.error('Error fetching Project Engineer for custom email:', peErr);
      }
    }

    const fromHeader = peEmail 
      ? `"${peName}" <${process.env.SMTP_USER || 'aarti.j@semcogroups.com'}>`
      : `"SEMCO Portal" <${process.env.SMTP_USER || 'aarti.j@semcogroups.com'}>`;

    const attachments = [];
    if (attachment && attachment.data && attachment.filename) {
      attachments.push({
        filename: attachment.filename,
        content: Buffer.from(attachment.data, 'base64')
      });
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #10b981; margin: 0;">SEMCO Groups</h2>
          <span style="color: #777777; font-size: 0.9rem;">Project Confirmation</span>
        </div>
        <hr style="border: 0; border-top: 1px solid #eeeeee;" />
        
        <!-- Thank You Message -->
        <div style="margin-top: 20px; color: #111827; font-size: 1.02rem; line-height: 1.6;">
          Dear ${enquiry.clientName && enquiry.clientName !== '-' ? enquiry.clientName : 'Client'},<br><br>
          Thank you for confirming your project order with SEMCO Groups. We are pleased to acknowledge your order.
        </div>

        <!-- Section 1: Company, PO, and Project Engineer Details -->
        <div style="background-color: #f9fafb; padding: 16px; border-radius: 10px; border: 1px solid #e5e7eb; margin-top: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; line-height: 1.5;">
            <tr>
              <td style="color: #6b7280; font-weight: bold; width: 180px; padding: 4px 0; vertical-align: top;">Company Name:</td>
              <td style="color: #111827; padding: 4px 0; font-weight: bold; font-size: 0.95rem;">${enquiry.companyName}</td>
            </tr>
            <tr>
              <td style="color: #6b7280; font-weight: bold; padding: 4px 0; vertical-align: top;">PO Number:</td>
              <td style="color: #111827; padding: 4px 0; font-weight: bold; font-size: 0.95rem;">${enquiry.poNumber || '-'}</td>
            </tr>
            ${peName && peName !== '-' ? `
              <tr>
                <td style="color: #6b7280; font-weight: bold; padding: 4px 0; vertical-align: top;">Project Engineer:</td>
                <td style="color: #111827; padding: 4px 0;">
                  <strong style="color: #3b82f6;">${peName}</strong><br />
                  <span style="font-size: 0.82rem; color: #6b7280;">Email: <a href="mailto:${peEmail || 'aarti.j@semcogroups.com'}" style="color: #3b82f6; text-decoration: none;">${peEmail || '-'}</a></span><br />
                  ${pePhone ? `<span style="font-size: 0.82rem; color: #6b7280;">Contact: ${pePhone}</span>` : ''}
                </td>
              </tr>
            ` : ''}
          </table>
        </div>

        <!-- Section 2: Custom Written Text -->
        <div style="margin-top: 24px;">
          <div style="color: #111827; font-size: 1.05rem; line-height: 1.6; white-space: pre-wrap; background: #ffffff; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px;">
            ${message.replace(/\n/g, '<br>')}
          </div>
        </div>

        <!-- Project Engineer Signature -->
        <div style="margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          <p style="color: #4b5563; font-size: 0.95rem; margin: 0 0 6px 0;">Best regards,</p>
          ${peName && peName !== '-' ? `
            <p style="color: #111827; font-size: 1.05rem; font-weight: bold; margin: 0 0 2px 0;">${peName}</p>
            <p style="color: #4b5563; font-size: 0.85rem; margin: 0 0 2px 0;">Project Engineer</p>
            <p style="color: #6b7280; font-size: 0.85rem; margin: 0 0 2px 0;">SEMCO Groups</p>
            ${peEmail ? `<p style="color: #6b7280; font-size: 0.85rem; margin: 0 0 2px 0;">Email: <a href="mailto:${peEmail}" style="color: #3b82f6; text-decoration: none;">${peEmail}</a></p>` : ''}
            ${pePhone ? `<p style="color: #6b7280; font-size: 0.85rem; margin: 0;">Contact: ${pePhone}</p>` : ''}
          ` : `
            <p style="color: #111827; font-size: 1.05rem; font-weight: bold; margin: 0 0 2px 0;">SEMCO Groups Team</p>
            <p style="color: #6b7280; font-size: 0.85rem; margin: 0 0 2px 0;">SEMCO Groups</p>
            <p style="color: #6b7280; font-size: 0.85rem; margin: 0 0 2px 0;">Email: <a href="mailto:aarti.j@semcogroups.com" style="color: #3b82f6; text-decoration: none;">aarti.j@semcogroups.com</a></p>
          `}
        </div>

        <p style="color: #999999; font-size: 0.8rem; margin-top: 32px; text-align: center;">
          &copy; 2026 SEMCO Groups. All rights reserved.
        </p>
      </div>
    `;

    const poNumber = enquiry.poNumber || '-';
    const fallbackSubject = `Project Confirmation - PO: ${poNumber}`;

    const mailOptions = {
      from: fromHeader,
      to: clientEmail.trim(),
      cc: cc ? cc.trim() : undefined,
      replyTo: peEmail || undefined,
      subject: subject ? subject.trim() : fallbackSubject,
      html: emailHtml,
      attachments: attachments
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Custom Client Email] Email sent successfully to "${clientEmail}" for PO: "${enquiry.poNumber || '-'}".`);

    return res.json({ message: 'Email sent successfully to the client!' });
  } catch (error) {
    console.error('Error sending custom client email:', error);
    return res.status(500).json({ message: 'Failed to send email to the client', error: error.message });
  }
});

// TEMPORARY: SMTP diagnostic endpoint — REMOVE after debugging
router.get('/debug/smtp-test', async (req, res) => {
  try {
    console.log('[SMTP Debug] Testing SMTP connection...');
    console.log('[SMTP Debug] Host:', process.env.SMTP_HOST || 'smtp.office365.com');
    console.log('[SMTP Debug] Port:', process.env.SMTP_PORT || '587');
    console.log('[SMTP Debug] User:', process.env.SMTP_USER || 'aarti.j@semcogroups.com');
    console.log('[SMTP Debug] Pass length:', (process.env.SMTP_PASS || '$emc0rp@2026').length);
    
    await transporter.verify();
    return res.json({ 
      status: 'SMTP connection verified successfully',
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      user: process.env.SMTP_USER || 'aarti.j@semcogroups.com',
      passLength: (process.env.SMTP_PASS || '$emc0rp@2026').length
    });
  } catch (err) {
    console.error('[SMTP Debug] Error:', err);
    return res.status(500).json({ 
      status: 'SMTP connection FAILED',
      error: err.message,
      code: err.code,
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      user: process.env.SMTP_USER || 'aarti.j@semcogroups.com',
      passLength: (process.env.SMTP_PASS || '$emc0rp@2026').length
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CRON: Weekly Enquiry Report — triggered every Monday 11 AM IST via Vercel Cron
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cron/weekly-report', async (req, res) => {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (cronSecret && (!authHeader || authHeader !== `Bearer ${cronSecret}`)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Calculate date range: last 7 days
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Query enquiries created in the last 7 days
    const enquiries = await Enquiry.find({
      createdAt: { $gte: oneWeekAgo, $lte: now }
    }).sort({ createdAt: -1 }).lean();

    if (!enquiries || enquiries.length === 0) {
      console.log('[Weekly Report] No enquiries found in the last 7 days. Skipping email.');
      return res.json({ message: 'No enquiries in the last week. Report not sent.' });
    }

    // Find all Admin users
    const admins = await User.find({ role: 'Admin', isEmailVerified: true }).lean();
    if (!admins || admins.length === 0) {
      console.log('[Weekly Report] No verified Admin users found. Skipping email.');
      return res.json({ message: 'No Admin users found. Report not sent.' });
    }

    const adminEmails = admins.map(a => a.username).filter(Boolean);
    if (adminEmails.length === 0) {
      return res.json({ message: 'No Admin email addresses found. Report not sent.' });
    }

    // Generate CSV content
    const csvHeaders = [
      'Date',
      'Quotation Number',
      'Client Name',
      'Company Name',
      'Enquiry Details',
      'Major Equipments',
      'Enquiry Source',
      'FPR',
      'Mail ID',
      'Contact Country Code',
      'Contact Number',
      'Current Status',
      'Offer Submitted Date',
      'PO Number',
      'Expected Date Of Dispatch',
      'Project Engineer',
      'Follow-Up Comments',
      'Created By',
      'Created At'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const csvRows = [csvHeaders.join(',')];
    for (const enq of enquiries) {
      const row = [
        enq.date || '',
        enq.quotationNumber || '',
        enq.clientName || '',
        enq.companyName || '',
        enq.enquiryDetails || '',
        enq.majorEquipments || '',
        enq.enquirySource || '',
        enq.fpr || '',
        enq.mailId || '',
        enq.contactCountryCode || '',
        enq.contactNumber || '',
        enq.currentStatus || '',
        enq.offerSubmittedDate || '',
        enq.poNumber || '',
        enq.expectedDateOfDispatch || '',
        enq.projectEngineer || '',
        enq.followUpComments || '',
        enq.createdBy || '',
        enq.createdAt ? new Date(enq.createdAt).toISOString().split('T')[0] : ''
      ].map(escapeCSV);
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    // Format date range for email
    const formatDate = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const fromDate = formatDate(oneWeekAgo);
    const toDate = formatDate(now);
    const fileName = `Enquiry_Report_${oneWeekAgo.toISOString().split('T')[0]}_to_${now.toISOString().split('T')[0]}.csv`;

    // Build email HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1a73e8; margin: 0;">SEMCO Groups</h2>
          <span style="color: #777777; font-size: 0.9rem;">Enquiry Management Portal</span>
        </div>
        <hr style="border: 0; border-top: 1px solid #eeeeee;" />
        <h3 style="color: #333333; margin-top: 24px;">📊 Weekly Enquiry Report</h3>
        <p style="color: #555555; font-size: 1rem; line-height: 1.6;">
          Please find attached the weekly enquiry report for the period <strong>${fromDate}</strong> to <strong>${toDate}</strong>.
        </p>
        <div style="background: #f0f4ff; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #555; font-size: 0.95rem; padding: 6px 0;">Total Enquiries:</td>
              <td style="color: #1a73e8; font-size: 1.1rem; font-weight: 700; text-align: right;">${enquiries.length}</td>
            </tr>
            <tr>
              <td style="color: #555; font-size: 0.95rem; padding: 6px 0;">Period:</td>
              <td style="color: #333; font-size: 0.95rem; text-align: right;">${fromDate} – ${toDate}</td>
            </tr>
          </table>
        </div>
        <p style="color: #777777; font-size: 0.85rem; line-height: 1.5;">
          This is an automated weekly report generated by the SEMCO Enquiry Management Portal. The CSV file is attached to this email.
        </p>
        <p style="color: #999999; font-size: 0.8rem; margin-top: 32px; text-align: center;">
          &copy; 2026 SEMCO Groups. All rights reserved.
        </p>
      </div>
    `;

    // Send email to all admins
    const mailOptions = {
      from: `"SEMCO Portal" <${process.env.SMTP_USER || 'aarti.j@semcogroups.com'}>`,
      to: adminEmails.join(', '),
      subject: `Weekly Enquiry Report (${fromDate} – ${toDate})`,
      html: emailHtml,
      attachments: [
        {
          filename: fileName,
          content: csvContent,
          contentType: 'text/csv'
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Weekly Report] Report sent successfully to ${adminEmails.length} admin(s): ${adminEmails.join(', ')}`);
    console.log(`[Weekly Report] ${enquiries.length} enquiries included in the report.`);

    return res.json({
      message: 'Weekly report sent successfully!',
      adminCount: adminEmails.length,
      enquiryCount: enquiries.length,
      period: `${fromDate} – ${toDate}`
    });
  } catch (error) {
    console.error('[Weekly Report] Error:', error);
    return res.status(500).json({ message: 'Failed to send weekly report', error: error.message });
  }
});

export default router;
