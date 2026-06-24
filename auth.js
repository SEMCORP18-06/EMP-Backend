import jwt from 'jsonwebtoken';
import { dbUser as User } from './db.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    try {
      const user = await User.findOne({ username: decoded.username });
      if (!user) {
        return res.status(403).json({ message: 'User not found or deleted' });
      }
      req.user = {
        id: user._id,
        username: user.username,
        role: user.role
      };
      next();
    } catch (dbErr) {
      console.error('Error in authenticateToken database lookup:', dbErr);
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Access denied: Admin privileges required' });
  }
  next();
};

export const requireActiveRole = (req, res, next) => {
  if (!req.user || (req.user.role !== 'Admin' && req.user.role !== 'General')) {
    return res.status(403).json({ message: 'Access denied: Account pending activation' });
  }
  next();
};
