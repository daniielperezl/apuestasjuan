const { hashPassword, comparePassword, getBogotaTime, encrypt, decrypt } = require('../../backend/utils/helpers');

describe('Auth Utils', () => {
  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true);
    });

    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      const valid = await comparePassword(password, hash);
      expect(valid).toBe(true);
    });

    it('should reject wrong password', async () => {
      const hash = await hashPassword('CorrectPassword123!');
      const valid = await comparePassword('WrongPassword123!', hash);
      expect(valid).toBe(false);
    });
  });

  describe('Encryption', () => {
    beforeAll(() => {
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    });

    it('should encrypt and decrypt correctly', () => {
      const text = 'sensitive-secret-data';
      const encrypted = encrypt(text);
      expect(encrypted).not.toBe(text);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(text);
    });
  });

  describe('Time Utils', () => {
    it('should return Bogota time string', () => {
      const time = getBogotaTime();
      expect(typeof time).toBe('string');
      expect(time.length).toBeGreaterThan(0);
    });
  });
});
