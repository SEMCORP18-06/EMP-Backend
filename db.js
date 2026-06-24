import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const MOCK_FILE = path.join(process.cwd(), 'mock_db.json');

// In-memory data store for fallback
let mockUsers = [];
let mockEnquiries = [];
let mockEnquiriesBin = [];
let mockEquipments = [];
let mockFprs = [];
let mockProjectEngineers = [];

// Helper to save mock data
function saveMockData() {
  try {
    fs.writeFileSync(MOCK_FILE, JSON.stringify({ mockUsers, mockEnquiries, mockEnquiriesBin, mockEquipments, mockFprs, mockProjectEngineers }, null, 2));
  } catch (err) {
    console.error('Failed to save mock data to file:', err);
  }
}

// Pre-seed or load mock data
(async () => {
  const defaultEquips = ["CHPR", "DC", "HE", "ATFE", "ATFD", "SPDU", "LLE", "DVP", "VB"];
  const defaultFprs = [
    { name: "Mr. Mahendra Yadav", email: "Mahendra.y@semcogroups.com" },
    { name: "Mr. Jogender Dhayal", email: "Jogender.d@semcogroups.com" },
    { name: "Ms. Rutuja Adak", email: "Rutuja.a@semcogroups.com" },
    { name: "Mr. Umesh Patil", email: "Umesh.p@semcogroups.com" },
    { name: "Ms. Arati Janokar", email: "Aarti.j@semcogroups.com" },
    { name: "Mr. Pratik Patil", email: "Pratik.p@semcogroups.com" },
    { name: "Mr. Shrikant Munje", email: "store.semcorp@semcogroups.com" }
  ];
  const defaultProjectEngineers = [
    { name: "Pratik Patil", email: "pratik.p@semcogroups.com", contactNumber: "9684011617" }
  ];

  if (fs.existsSync(MOCK_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(MOCK_FILE, 'utf8'));
      mockUsers = data.mockUsers || [];
      mockEnquiries = data.mockEnquiries || [];
      mockEnquiriesBin = data.mockEnquiriesBin || [];
      mockEquipments = data.mockEquipments || [];
      mockFprs = data.mockFprs || [];
      mockProjectEngineers = data.mockProjectEngineers || [];
      if (!mockEquipments || mockEquipments.length === 0) {
        mockEquipments = defaultEquips.map((name, index) => ({
          _id: 'eq_' + (index + 1),
          name,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
        saveMockData();
      }
      if (!mockFprs || mockFprs.length === 0) {
        mockFprs = defaultFprs.map((item, index) => ({
          _id: 'fpr_' + (index + 1),
          name: item.name,
          email: item.email,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
        saveMockData();
      }
      if (!mockProjectEngineers || mockProjectEngineers.length === 0) {
        mockProjectEngineers = defaultProjectEngineers.map((item, index) => ({
          _id: 'pe_' + (index + 1),
          name: item.name,
          email: item.email,
          contactNumber: item.contactNumber,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
        saveMockData();
      }
      console.log('Loaded mock database from local mock_db.json');
      return;
    } catch (err) {
      console.error('Failed to load mock_db.json, re-seeding:', err);
    }
  }

  mockUsers = [];
  mockEnquiries = [
    {
      _id: 'e1',
      date: new Date().toISOString().split('T')[0],
      quotationNumber: 'QTN-2026-001',
      clientName: 'Suresh Kumar',
      companyName: 'Semco India Ltd',
      enquiryDetails: 'Sourcing 5 chemical pumps with secondary safety containment systems.',
      majorEquipments: 'Chemical Containment Pumps',
      enquirySource: 'Website',
      mailId: 'suresh@semcoindia.com',
      contactCountryCode: '+91',
      contactNumber: '98765 43210',
      currentStatus: 'Costing',
      offerSubmittedDate: '',
      poNumber: '',
      followUpComments: 'Requested technical data sheets from engineering team.',
      milestones: [],
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(Date.now() - 3600000)
    },
    {
      _id: 'e2',
      date: new Date().toISOString().split('T')[0],
      quotationNumber: 'QTN-2026-002',
      clientName: 'Priya Sharma',
      companyName: 'Apex Pharmaceuticals',
      enquiryDetails: 'Urgent replacement order for industrial water cooling tower packages.',
      majorEquipments: 'Water Cooling Towers',
      enquirySource: 'Referral',
      mailId: 'priya@apexpharma.in',
      contactCountryCode: '+91',
      contactNumber: '99887 76655',
      currentStatus: 'Confirmed',
      offerSubmittedDate: new Date().toISOString().split('T')[0],
      poNumber: 'PO-998877',
      followUpComments: 'Initial proposal sent. Client confirmed order.',
      milestones: [
        { name: 'Engineering Drawings', fpr: 'Rajesh Kumar', startDate: new Date().toISOString().split('T')[0], endDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], actualEndDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], status: 'Completed', remark: 'Approved by client engineering lead.' },
        { name: 'Procurement of Parts', fpr: 'Prakash Singh', startDate: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0], endDate: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0], actualEndDate: '', status: 'In Progress', remark: 'Casing and pump seals ordered.' },
        { name: 'Assembly & Testing', fpr: 'Anil Mehta', startDate: new Date(Date.now() + 86400000 * 11).toISOString().split('T')[0], endDate: new Date(Date.now() + 86400000 * 16).toISOString().split('T')[0], actualEndDate: '', status: 'Pending', remark: 'Scheduled at Semco workshop.' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  mockEquipments = defaultEquips.map((name, index) => ({
    _id: 'eq_' + (index + 1),
    name,
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  mockFprs = defaultFprs.map((item, index) => ({
    _id: 'fpr_' + (index + 1),
    name: item.name,
    email: item.email,
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  mockProjectEngineers = defaultProjectEngineers.map((item, index) => ({
    _id: 'pe_' + (index + 1),
    name: item.name,
    email: item.email,
    contactNumber: item.contactNumber,
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  saveMockData();
})();

export let isUsingMock = false;

export function setUsingMock(val) {
  isUsingMock = val;
}

// Helper to filter mock lists based on Mongoose-like queries
function mockFilter(list, query) {
  if (!query || Object.keys(query).length === 0) return list;
  return list.filter(item => {
    for (const key of Object.keys(query)) {
      const qVal = query[key];
      const iVal = item[key];
      
      // Handle $or operator
      if (key === '$or' && Array.isArray(qVal)) {
        const matchesAny = qVal.some(subQuery => {
          return mockFilter([item], subQuery).length > 0;
        });
        if (!matchesAny) return false;
        continue;
      }
      
      // Handle $ne operator
      if (qVal && typeof qVal === 'object' && '$ne' in qVal) {
        if (String(iVal) === String(qVal.$ne)) {
          return false;
        }
        continue;
      }
      
      // Handle $regex operator
      if (qVal && typeof qVal === 'object' && '$regex' in qVal) {
        const regexStr = qVal.$regex;
        const options = qVal.$options || '';
        try {
          const regex = new RegExp(regexStr, options);
          if (!regex.test(String(iVal || ''))) {
            return false;
          }
        } catch (e) {
          if (!String(iVal || '').toLowerCase().includes(String(regexStr || '').toLowerCase())) {
            return false;
          }
        }
        continue;
      }
      
      // Default direct match
      if (String(iVal || '') !== String(qVal || '')) {
        return false;
      }
    }
    return true;
  });
}

// Wrapper for User operations
export const dbUser = {
  findOne: async (query) => {
    if (isUsingMock) {
      return mockUsers.find(u => {
        return Object.entries(query).every(([k, v]) => u[k] === v);
      }) || null;
    }
    try {
      const { User } = await import('./models.js');
      return await User.findOne(query);
    } catch (err) {
      console.error("MongoDB error in findOne, falling back to Mock Database:", err);
      setUsingMock(true);
      return mockUsers.find(u => {
        return Object.entries(query).every(([k, v]) => u[k] === v);
      }) || null;
    }
  },
  create: async ({ username, password, role, name, isEmailVerified, emailVerificationToken }) => {
    if (isUsingMock) {
      const newUser = { 
        _id: 'u_' + Date.now(), 
        username, 
        password, 
        role, 
        name: name || "",
        isEmailVerified: isEmailVerified || false,
        emailVerificationToken: emailVerificationToken || null
      };
      mockUsers.push(newUser);
      saveMockData();
      return newUser;
    }
    try {
      const { User } = await import('./models.js');
      return await User.create({ username, password, role, name, isEmailVerified, emailVerificationToken });
    } catch (err) {
      console.error("MongoDB error in User.create, falling back to Mock Database:", err);
      setUsingMock(true);
      const newUser = { 
        _id: 'u_' + Date.now(), 
        username, 
        password, 
        role, 
        name: name || "",
        isEmailVerified: isEmailVerified || false,
        emailVerificationToken: emailVerificationToken || null
      };
      mockUsers.push(newUser);
      saveMockData();
      return newUser;
    }
  },
  updateOne: async (query, updateData) => {
    const fields = updateData.$set || updateData;
    if (isUsingMock) {
      const user = mockUsers.find(u => {
        return Object.entries(query).every(([k, v]) => u[k] === v);
      });
      if (!user) return null;
      Object.assign(user, fields);
      saveMockData();
      return user;
    }
    try {
      const { User } = await import('./models.js');
      return await User.updateOne(query, { $set: fields });
    } catch (err) {
      console.error("MongoDB error in User.updateOne, falling back to Mock Database:", err);
      setUsingMock(true);
      const user = mockUsers.find(u => {
        return Object.entries(query).every(([k, v]) => u[k] === v);
      });
      if (!user) return null;
      Object.assign(user, fields);
      saveMockData();
      return user;
    }
  },
  find: async (query = {}) => {
    if (isUsingMock) {
      return mockUsers.filter(u => {
        return Object.entries(query).every(([k, v]) => u[k] === v);
      });
    }
    try {
      const { User } = await import('./models.js');
      return await User.find(query);
    } catch (err) {
      console.error("MongoDB error in User.find, falling back to Mock Database:", err);
      setUsingMock(true);
      return mockUsers.filter(u => {
        return Object.entries(query).every(([k, v]) => u[k] === v);
      });
    }
  },
  findByIdAndDelete: async (id) => {
    if (isUsingMock) {
      const idx = mockUsers.findIndex(u => u._id === id);
      if (idx === -1) return null;
      const deleted = mockUsers[idx];
      mockUsers.splice(idx, 1);
      saveMockData();
      return deleted;
    }
    try {
      const { User } = await import('./models.js');
      return await User.findByIdAndDelete(id);
    } catch (err) {
      console.error("MongoDB error in User.findByIdAndDelete, falling back to Mock Database:", err);
      setUsingMock(true);
      const idx = mockUsers.findIndex(u => u._id === id);
      if (idx === -1) return null;
      const deleted = mockUsers[idx];
      mockUsers.splice(idx, 1);
      saveMockData();
      return deleted;
    }
  }
};

// Wrapper for Enquiry operations
export const dbEnquiry = {
  find: (query = {}) => {
    return {
      sort: async (criteria) => {
        if (isUsingMock) {
          let list = mockFilter([...mockEnquiries], query);
          // Sort descending by createdAt
          return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        try {
          const { Enquiry } = await import('./models.js');
          return await Enquiry.find(query).sort(criteria);
        } catch (err) {
          console.error("MongoDB error in Enquiry.find, falling back to Mock Database:", err);
          setUsingMock(true);
          let list = mockFilter([...mockEnquiries], query);
          return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
      }
    };
  },
  findById: async (id) => {
    if (isUsingMock) {
      return mockEnquiries.find(e => e._id === id) || null;
    }
    try {
      const { Enquiry } = await import('./models.js');
      return await Enquiry.findById(id);
    } catch (err) {
      console.error("MongoDB error in Enquiry.findById, falling back to Mock Database:", err);
      setUsingMock(true);
      return mockEnquiries.find(e => e._id === id) || null;
    }
  },
  create: async (data) => {
    if (isUsingMock) {
      const newEnq = {
        _id: 'e_' + Date.now(),
        ...data,
        milestones: data.milestones || [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockEnquiries.push(newEnq);
      saveMockData();
      return newEnq;
    }
    try {
      const { Enquiry } = await import('./models.js');
      const enq = new Enquiry(data);
      return await enq.save();
    } catch (err) {
      if (err.name === 'ValidationError' || err.name === 'CastError' || err.code === 11000) {
        throw err;
      }
      console.error("MongoDB error in Enquiry.create, falling back to Mock Database:", err);
      setUsingMock(true);
      const newEnq = {
        _id: 'e_' + Date.now(),
        ...data,
        milestones: data.milestones || [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockEnquiries.push(newEnq);
      saveMockData();
      return newEnq;
    }
  },
  findByIdAndUpdate: async (id, updateData) => {
    const fields = updateData.$set || updateData;
    if (isUsingMock) {
      const idx = mockEnquiries.findIndex(e => e._id === id);
      if (idx === -1) return null;
      mockEnquiries[idx] = {
        ...mockEnquiries[idx],
        ...fields,
        updatedAt: new Date()
      };
      saveMockData();
      return mockEnquiries[idx];
    }
    try {
      const { Enquiry } = await import('./models.js');
      return await Enquiry.findByIdAndUpdate(id, { $set: fields }, { new: true, runValidators: true });
    } catch (err) {
      if (err.name === 'ValidationError' || err.name === 'CastError' || err.code === 11000) {
        throw err;
      }
      console.error("MongoDB error in Enquiry.findByIdAndUpdate, falling back to Mock Database:", err);
      setUsingMock(true);
      const idx = mockEnquiries.findIndex(e => e._id === id);
      if (idx === -1) return null;
      mockEnquiries[idx] = {
        ...mockEnquiries[idx],
        ...fields,
        updatedAt: new Date()
      };
      saveMockData();
      return mockEnquiries[idx];
    }
  },
  findByIdAndDelete: async (id) => {
    if (isUsingMock) {
      const idx = mockEnquiries.findIndex(e => e._id === id);
      if (idx === -1) return null;
      const deleted = mockEnquiries[idx];
      mockEnquiries.splice(idx, 1);
      saveMockData();
      return deleted;
    }
    try {
      const { Enquiry } = await import('./models.js');
      return await Enquiry.findByIdAndDelete(id);
    } catch (err) {
      console.error("MongoDB error in Enquiry.findByIdAndDelete, falling back to Mock Database:", err);
      setUsingMock(true);
      const idx = mockEnquiries.findIndex(e => e._id === id);
      if (idx === -1) return null;
      const deleted = mockEnquiries[idx];
      mockEnquiries.splice(idx, 1);
      saveMockData();
      return deleted;
    }
  }
};

// Wrapper for Bin Enquiry operations
export const dbBinEnquiry = {
  find: (query = {}) => {
    return {
      sort: async (criteria) => {
        if (isUsingMock) {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          mockEnquiriesBin = mockEnquiriesBin.filter(e => new Date(e.createdAt) >= thirtyDaysAgo);
          let list = mockFilter([...mockEnquiriesBin], query);
          return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        try {
          const { BinEnquiry } = await import('./models.js');
          return await BinEnquiry.find(query).sort(criteria);
        } catch (err) {
          console.error("MongoDB error in BinEnquiry.find, falling back to Mock Database:", err);
          setUsingMock(true);
          let list = mockFilter([...mockEnquiriesBin], query);
          return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
      }
    };
  },
  findById: async (id) => {
    if (isUsingMock) {
      return mockEnquiriesBin.find(e => e._id === id) || null;
    }
    try {
      const { BinEnquiry } = await import('./models.js');
      return await BinEnquiry.findById(id);
    } catch (err) {
      console.error("MongoDB error in BinEnquiry.findById, falling back to Mock Database:", err);
      setUsingMock(true);
      return mockEnquiriesBin.find(e => e._id === id) || null;
    }
  },
  create: async (data) => {
    if (isUsingMock) {
      const newBinEnq = {
        _id: data._id || 'e_' + Date.now(),
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: new Date()
      };
      mockEnquiriesBin.push(newBinEnq);
      saveMockData();
      return newBinEnq;
    }
    try {
      const { BinEnquiry } = await import('./models.js');
      const bEnq = new BinEnquiry(data);
      return await bEnq.save();
    } catch (err) {
      if (err.name === 'ValidationError' || err.name === 'CastError' || err.code === 11000) {
        throw err;
      }
      console.error("MongoDB error in BinEnquiry.create, falling back to Mock Database:", err);
      setUsingMock(true);
      const newBinEnq = {
        _id: data._id || 'e_' + Date.now(),
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: new Date()
      };
      mockEnquiriesBin.push(newBinEnq);
      saveMockData();
      return newBinEnq;
    }
  },
  findByIdAndDelete: async (id) => {
    if (isUsingMock) {
      const idx = mockEnquiriesBin.findIndex(e => e._id === id);
      if (idx === -1) return null;
      const deleted = mockEnquiriesBin[idx];
      mockEnquiriesBin.splice(idx, 1);
      saveMockData();
      return deleted;
    }
    try {
      const { BinEnquiry } = await import('./models.js');
      return await BinEnquiry.findByIdAndDelete(id);
    } catch (err) {
      console.error("MongoDB error in BinEnquiry.findByIdAndDelete, falling back to Mock Database:", err);
      setUsingMock(true);
      const idx = mockEnquiriesBin.findIndex(e => e._id === id);
      if (idx === -1) return null;
      const deleted = mockEnquiriesBin[idx];
      mockEnquiriesBin.splice(idx, 1);
      saveMockData();
      return deleted;
    }
  },
  deleteMany: async (query = {}) => {
    if (isUsingMock) {
      const originalLength = mockEnquiriesBin.length;
      if (query.createdBy) {
        mockEnquiriesBin = mockEnquiriesBin.filter(e => e.createdBy !== query.createdBy);
      } else {
        mockEnquiriesBin = [];
      }
      saveMockData();
      return { deletedCount: originalLength - mockEnquiriesBin.length };
    }
    try {
      const { BinEnquiry } = await import('./models.js');
      return await BinEnquiry.deleteMany(query);
    } catch (err) {
      console.error("MongoDB error in BinEnquiry.deleteMany, falling back to Mock Database:", err);
      setUsingMock(true);
      const originalLength = mockEnquiriesBin.length;
      if (query.createdBy) {
        mockEnquiriesBin = mockEnquiriesBin.filter(e => e.createdBy !== query.createdBy);
      } else {
        mockEnquiriesBin = [];
      }
      saveMockData();
      return { deletedCount: originalLength - mockEnquiriesBin.length };
    }
  }
};

export async function cleanExpiredBinEnquiries() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  if (isUsingMock) {
    const originalLength = mockEnquiriesBin.length;
    mockEnquiriesBin = mockEnquiriesBin.filter(e => new Date(e.createdAt) >= thirtyDaysAgo);
    if (mockEnquiriesBin.length !== originalLength) {
      saveMockData();
      console.log(`[Mock Cleanup] Removed ${originalLength - mockEnquiriesBin.length} expired enquiries from bin.`);
    }
  } else {
    try {
      const { BinEnquiry } = await import('./models.js');
      const result = await BinEnquiry.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
      if (result.deletedCount > 0) {
        console.log(`[MongoDB Cleanup] Removed ${result.deletedCount} expired enquiries from bin.`);
      }
    } catch (err) {
      console.error("MongoDB error in cleanExpiredBinEnquiries, falling back to Mock Database:", err);
      setUsingMock(true);
      const originalLength = mockEnquiriesBin.length;
      mockEnquiriesBin = mockEnquiriesBin.filter(e => new Date(e.createdAt) >= thirtyDaysAgo);
      if (mockEnquiriesBin.length !== originalLength) {
        saveMockData();
      }
    }
  }
}

export function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  // 1. Check if already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Check if DD-MM-YYYY or DD/MM/YYYY
  const dmYMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmYMatch) {
    const day = dmYMatch[1].padStart(2, '0');
    const month = dmYMatch[2].padStart(2, '0');
    const year = dmYMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 3. Check if YYYY/MM/DD
  const YmdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (YmdMatch) {
    const year = YmdMatch[1];
    const month = YmdMatch[2].padStart(2, '0');
    const day = YmdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 4. Try standard JS parsing
  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch (e) {
    // Ignore
  }

  return trimmed;
}

export function isDuplicate(enq1, enq2) {
  if (!enq1 || !enq2) return false;

  // 1. Client Name (case-insensitive, trimmed)
  const client1 = (enq1.clientName || '').trim().toLowerCase();
  const client2 = (enq2.clientName || '').trim().toLowerCase();
  if (client1 !== client2) return false;

  // 2. Company Name (case-insensitive, trimmed)
  const company1 = (enq1.companyName || '').trim().toLowerCase();
  const company2 = (enq2.companyName || '').trim().toLowerCase();
  if (company1 !== company2) return false;

  // 3. Contact Number (trimmed, non-digits removed for comparison)
  const contact1 = (enq1.contactNumber || '').replace(/\D/g, '');
  const contact2 = (enq2.contactNumber || '').replace(/\D/g, '');
  if (contact1 !== contact2) return false;

  // 4. Mail Id (case-insensitive, trimmed)
  const mail1 = (enq1.mailId || '').trim().toLowerCase();
  const mail2 = (enq2.mailId || '').trim().toLowerCase();
  if (mail1 !== mail2) return false;

  // 5. Major Equipments (order-independent comparison, case-insensitive, trimmed)
  const getEquipKey = (eqStr) => {
    return (eqStr || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join(',');
  };
  const eqKey1 = getEquipKey(enq1.majorEquipments);
  const eqKey2 = getEquipKey(enq2.majorEquipments);
  if (eqKey1 !== eqKey2) return false;

  return true;
}

export async function cleanDuplicateEnquiries() {
  if (isUsingMock) {
    const seenQuotes = new Set();
    const seenEnquiries = [];
    const originalLength = mockEnquiries.length;
    
    // Sort oldest first to keep the oldest record
    const sorted = [...mockEnquiries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const uniqueList = [];
    
    for (const enq of sorted) {
      let isDup = false;
      const qNorm = enq.quotationNumber && enq.quotationNumber.trim() ? enq.quotationNumber.trim().toLowerCase() : '';
      
      if (qNorm && seenQuotes.has(qNorm)) {
        isDup = true;
      }
      
      if (!isDup) {
        const matched = seenEnquiries.find(seen => isDuplicate(seen, enq));
        if (matched) {
          isDup = true;
        }
      }
      
      if (!isDup) {
        uniqueList.push(enq);
        if (qNorm) {
          seenQuotes.add(qNorm);
        }
        seenEnquiries.push(enq);
      }
    }
    
    if (uniqueList.length !== originalLength) {
      mockEnquiries = uniqueList;
      saveMockData();
      console.log(`[Mock Cleanup] Auto-removed ${originalLength - uniqueList.length} duplicate enquiries.`);
    }
  } else {
    try {
      const { Enquiry } = await import('./models.js');
      // Fetch all records, oldest first
      const list = await Enquiry.find().sort({ createdAt: 1 });
      
      const seenQuotes = new Set();
      const seenEnquiries = [];
      const duplicateIds = [];
      
      for (const enq of list) {
        let isDup = false;
        const qNorm = enq.quotationNumber && enq.quotationNumber.trim() ? enq.quotationNumber.trim().toLowerCase() : '';
        
        if (qNorm && seenQuotes.has(qNorm)) {
          isDup = true;
        }
        
        if (!isDup) {
          const matched = seenEnquiries.find(seen => isDuplicate(seen, enq));
          if (matched) {
            isDup = true;
          }
        }
        
        if (isDup) {
          duplicateIds.push(enq._id);
        } else {
          if (qNorm) {
            seenQuotes.add(qNorm);
          }
          seenEnquiries.push(enq);
        }
      }
      
      if (duplicateIds.length > 0) {
        const res = await Enquiry.deleteMany({ _id: { $in: duplicateIds } });
        console.log(`[MongoDB Cleanup] Auto-deleted ${res.deletedCount} duplicate enquiries.`);
      }
    } catch (err) {
      console.error("MongoDB error in cleanDuplicateEnquiries:", err);
    }
  }
}

export const dbEquipment = {
  find: () => {
    return {
      sort: async (criteria) => {
        if (isUsingMock) {
          return [...mockEquipments].sort((a, b) => a.name.localeCompare(b.name));
        }
        try {
          const { Equipment } = await import('./models.js');
          return await Equipment.find().sort(criteria);
        } catch (err) {
          console.error("MongoDB error in Equipment.find, falling back to Mock Database:", err);
          setUsingMock(true);
          return [...mockEquipments].sort((a, b) => a.name.localeCompare(b.name));
        }
      }
    };
  },
  create: async (data) => {
    if (isUsingMock) {
      const newEquip = {
        _id: 'eq_' + Date.now(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockEquipments.push(newEquip);
      saveMockData();
      return newEquip;
    }
    try {
      const { Equipment } = await import('./models.js');
      const equip = new Equipment(data);
      return await equip.save();
    } catch (err) {
      console.error("MongoDB error in Equipment.create, falling back to Mock Database:", err);
      setUsingMock(true);
      const newEquip = {
        _id: 'eq_' + Date.now(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockEquipments.push(newEquip);
      saveMockData();
      return newEquip;
    }
  },
  findByIdAndDelete: async (id) => {
    if (isUsingMock) {
      const idx = mockEquipments.findIndex(e => e._id === id);
      if (idx === -1) return null;
      const deleted = mockEquipments[idx];
      mockEquipments.splice(idx, 1);
      saveMockData();
      return deleted;
    }
    try {
      const { Equipment } = await import('./models.js');
      return await Equipment.findByIdAndDelete(id);
    } catch (err) {
      console.error("MongoDB error in Equipment.findByIdAndDelete, falling back to Mock Database:", err);
      setUsingMock(true);
      const idx = mockEquipments.findIndex(e => e._id === id);
      if (idx === -1) return null;
      const deleted = mockEquipments[idx];
      mockEquipments.splice(idx, 1);
      saveMockData();
      return deleted;
    }
  },
  findOne: async (query) => {
    if (isUsingMock) {
      if (query.name && typeof query.name === 'object' && query.name.$regex) {
        const pattern = new RegExp(query.name.$regex, query.name.$options || '');
        return mockEquipments.find(e => pattern.test(e.name)) || null;
      }
      return mockEquipments.find(e => e.name === query.name) || null;
    }
    try {
      const { Equipment } = await import('./models.js');
      return await Equipment.findOne(query);
    } catch (err) {
      console.error("MongoDB error in Equipment.findOne, falling back to Mock Database:", err);
      setUsingMock(true);
      if (query.name && typeof query.name === 'object' && query.name.$regex) {
        const pattern = new RegExp(query.name.$regex, query.name.$options || '');
        return mockEquipments.find(e => pattern.test(e.name)) || null;
      }
      return mockEquipments.find(e => e.name === query.name) || null;
    }
  }
};

// Wrapper for FPR operations
export const dbFpr = {
  find: () => {
    return {
      sort: async (criteria) => {
        if (isUsingMock) {
          return [...mockFprs].sort((a, b) => a.name.localeCompare(b.name));
        }
        try {
          const { Fpr } = await import('./models.js');
          return await Fpr.find().sort(criteria);
        } catch (err) {
          console.error("MongoDB error in Fpr.find, falling back to Mock Database:", err);
          setUsingMock(true);
          return [...mockFprs].sort((a, b) => a.name.localeCompare(b.name));
        }
      }
    };
  },
  create: async (data) => {
    if (isUsingMock) {
      const newFpr = {
        _id: 'fpr_' + Date.now(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockFprs.push(newFpr);
      saveMockData();
      return newFpr;
    }
    try {
      const { Fpr } = await import('./models.js');
      const fpr = new Fpr(data);
      return await fpr.save();
    } catch (err) {
      console.error("MongoDB error in Fpr.create, falling back to Mock Database:", err);
      setUsingMock(true);
      const newFpr = {
        _id: 'fpr_' + Date.now(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockFprs.push(newFpr);
      saveMockData();
      return newFpr;
    }
  },
  findByIdAndDelete: async (id) => {
    if (isUsingMock) {
      const idx = mockFprs.findIndex(f => f._id === id);
      if (idx === -1) return null;
      const deleted = mockFprs[idx];
      mockFprs.splice(idx, 1);
      saveMockData();
      return deleted;
    }
    try {
      const { Fpr } = await import('./models.js');
      return await Fpr.findByIdAndDelete(id);
    } catch (err) {
      console.error("MongoDB error in Fpr.findByIdAndDelete, falling back to Mock Database:", err);
      setUsingMock(true);
      const idx = mockFprs.findIndex(f => f._id === id);
      if (idx === -1) return null;
      const deleted = mockFprs[idx];
      mockFprs.splice(idx, 1);
      saveMockData();
      return deleted;
    }
  },
  findOne: async (query) => {
    if (isUsingMock) {
      if (query.name && typeof query.name === 'object' && query.name.$regex) {
        const pattern = new RegExp(query.name.$regex, query.name.$options || '');
        return mockFprs.find(f => pattern.test(f.name)) || null;
      }
      return mockFprs.find(f => f.name === query.name) || null;
    }
    try {
      const { Fpr } = await import('./models.js');
      return await Fpr.findOne(query);
    } catch (err) {
      console.error("MongoDB error in Fpr.findOne, falling back to Mock Database:", err);
      setUsingMock(true);
      if (query.name && typeof query.name === 'object' && query.name.$regex) {
        const pattern = new RegExp(query.name.$regex, query.name.$options || '');
        return mockFprs.find(f => pattern.test(f.name)) || null;
      }
      return mockFprs.find(f => f.name === query.name) || null;
    }
  }
};

export const dbProjectEngineer = {
  find: () => {
    return {
      sort: async (criteria) => {
        if (isUsingMock) {
          return [...mockProjectEngineers].sort((a, b) => a.name.localeCompare(b.name));
        }
        try {
          const { ProjectEngineer } = await import('./models.js');
          return await ProjectEngineer.find().sort(criteria);
        } catch (err) {
          console.error("MongoDB error in ProjectEngineer.find, falling back to Mock Database:", err);
          setUsingMock(true);
          return [...mockProjectEngineers].sort((a, b) => a.name.localeCompare(b.name));
        }
      }
    };
  },
  create: async (data) => {
    if (isUsingMock) {
      const newPe = {
        _id: 'pe_' + Date.now(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockProjectEngineers.push(newPe);
      saveMockData();
      return newPe;
    }
    try {
      const { ProjectEngineer } = await import('./models.js');
      const pe = new ProjectEngineer(data);
      return await pe.save();
    } catch (err) {
      console.error("MongoDB error in ProjectEngineer.create, falling back to Mock Database:", err);
      setUsingMock(true);
      const newPe = {
        _id: 'pe_' + Date.now(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockProjectEngineers.push(newPe);
      saveMockData();
      return newPe;
    }
  },
  findByIdAndDelete: async (id) => {
    if (isUsingMock) {
      const idx = mockProjectEngineers.findIndex(p => p._id === id);
      if (idx === -1) return null;
      const deleted = mockProjectEngineers[idx];
      mockProjectEngineers.splice(idx, 1);
      saveMockData();
      return deleted;
    }
    try {
      const { ProjectEngineer } = await import('./models.js');
      return await ProjectEngineer.findByIdAndDelete(id);
    } catch (err) {
      console.error("MongoDB error in ProjectEngineer.findByIdAndDelete, falling back to Mock Database:", err);
      setUsingMock(true);
      const idx = mockProjectEngineers.findIndex(p => p._id === id);
      if (idx === -1) return null;
      const deleted = mockProjectEngineers[idx];
      mockProjectEngineers.splice(idx, 1);
      saveMockData();
      return deleted;
    }
  },
  findOne: async (query) => {
    if (isUsingMock) {
      return mockProjectEngineers.find(p => {
        return Object.entries(query).every(([k, v]) => {
          if (v && typeof v === 'object' && v.$regex) {
            const pattern = new RegExp(v.$regex, v.$options || '');
            return pattern.test(String(p[k] || ''));
          }
          return String(p[k] || '').toLowerCase() === String(v || '').toLowerCase();
        });
      }) || null;
    }
    try {
      const { ProjectEngineer } = await import('./models.js');
      return await ProjectEngineer.findOne(query);
    } catch (err) {
      console.error("MongoDB error in ProjectEngineer.findOne, falling back to Mock Database:", err);
      setUsingMock(true);
      return mockProjectEngineers.find(p => {
        return Object.entries(query).every(([k, v]) => {
          if (v && typeof v === 'object' && v.$regex) {
            const pattern = new RegExp(v.$regex, v.$options || '');
            return pattern.test(String(p[k] || ''));
          }
          return String(p[k] || '').toLowerCase() === String(v || '').toLowerCase();
        });
      }) || null;
    }
  }
};


