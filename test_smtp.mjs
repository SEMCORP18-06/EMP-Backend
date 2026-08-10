// Direct SMTP test - verify the transporter can connect and send
import 'dotenv/config';
import nodemailer from 'nodemailer';

console.log('SMTP Config:');
console.log('  Host:', process.env.SMTP_HOST || 'smtp.office365.com');
console.log('  Port:', process.env.SMTP_PORT || '587');
console.log('  User:', process.env.SMTP_USER || 'aarti.j@semcogroups.com');
console.log('  Pass:', (process.env.SMTP_PASS || '$emc0rp@2026').substring(0, 4) + '****');
console.log('');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'aarti.j@semcogroups.com',
    pass: process.env.SMTP_PASS || '$emc0rp@2026'
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false
  }
});

console.log('Verifying SMTP connection...');
transporter.verify()
  .then(() => {
    console.log('✅ SMTP connection verified successfully!');
    console.log('\nSending test email...');
    return transporter.sendMail({
      from: `"SEMCO Test" <${process.env.SMTP_USER || 'aarti.j@semcogroups.com'}>`,
      to: 'divyansh.agarwal900@gmail.com',
      subject: 'SMTP Test from Local',
      text: 'This is a test email to verify SMTP connectivity.'
    });
  })
  .then((info) => {
    console.log('✅ Test email sent! Message ID:', info.messageId);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ SMTP Error:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  });
