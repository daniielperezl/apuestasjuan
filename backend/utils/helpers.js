const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const generateSecurePassword = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

const hashPassword = async (password) => {
  return bcrypt.hash(password, 12);
};

const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

const encrypt = (text) => {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key.slice(0, 32), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (text) => {
  const [ivHex, encrypted] = text.split(':');
  const key = Buffer.from(process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key.slice(0, 32), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

const getBogotaTime = () => {
  return new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
};

const getBogotaDate = () => {
  const now = new Date();
  const bogota = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  bogota.setHours(0, 0, 0, 0);
  return bogota;
};

const getTodayRange = () => {
  const now = new Date();
  const bogota = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const start = new Date(bogota);
  start.setHours(0, 0, 0, 0);
  const end = new Date(bogota);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const sanitizeInput = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>'";&]/g, '');
};

const paginate = (page = 1, limit = 20) => {
  const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
  return { offset, limit: Math.min(100, parseInt(limit)) };
};

module.exports = {
  generateSecurePassword,
  hashPassword,
  comparePassword,
  encrypt,
  decrypt,
  getBogotaTime,
  getBogotaDate,
  getTodayRange,
  sanitizeInput,
  paginate
};
