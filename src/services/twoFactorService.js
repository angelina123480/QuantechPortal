const { authenticator } = require('otplib');
const QRCode = require('qrcode');

function generateSecret() {
  return authenticator.generateSecret();
}

async function buildQrCodeDataUrl(email, secret) {
  const otpauthUrl = authenticator.keyuri(email, 'QuanTech Support Portal', secret);
  return QRCode.toDataURL(otpauthUrl);
}

function verifyToken(token, secret) {
  try {
    return authenticator.verify({ token: String(token || '').trim(), secret });
  } catch (err) {
    return false;
  }
}

module.exports = { generateSecret, buildQrCodeDataUrl, verifyToken };
