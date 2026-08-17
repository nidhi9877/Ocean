const PERSONAL_EMAIL_DOMAINS = new Set([
  // Google
  'gmail.com',
  'googlemail.com',

  // Yahoo
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.in',
  'yahoo.ca',
  'yahoo.fr',
  'yahoo.de',
  'yahoo.es',
  'yahoo.it',
  'yahoo.com.au',
  'yahoo.com.br',
  'yahoo.co.jp',
  'ymail.com',
  'rocketmail.com',

  // Microsoft
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'hotmail.es',
  'hotmail.de',
  'hotmail.it',
  'outlook.com',
  'outlook.in',
  'outlook.fr',
  'outlook.de',
  'outlook.es',
  'live.com',
  'live.co.uk',
  'live.fr',
  'msn.com',
  'passport.com',

  // Apple
  'icloud.com',
  'me.com',
  'mac.com',

  // AOL
  'aol.com',
  'aim.com',

  // Proton
  'protonmail.com',
  'proton.me',
  'pm.me',

  // Zoho
  'zoho.com',
  'zohomail.com',

  // Mail.com & GMX
  'mail.com',
  'email.com',
  'usa.com',
  'post.com',
  'myself.com',
  'consultant.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'gmx.at',
  'gmx.ch',

  // Yandex & Russian
  'yandex.com',
  'yandex.ru',
  'ya.ru',
  'yandex.by',
  'yandex.kz',
  'yandex.ua',
  'mail.ru',
  'bk.ru',
  'inbox.ru',
  'list.ru',

  // Indian / Asian
  'rediffmail.com',
  'naver.com',
  'daum.net',
  'hanmail.net',
  'kakao.com',
  'qq.com',
  '163.com',
  '126.com',
  'yeah.net',
  'sina.com',
  'sohu.com',

  // Other Public / ISP Mail
  'fastmail.com',
  'fastmail.fm',
  'tutanota.com',
  'tutamail.com',
  'tuta.io',
  'tuta.com',
  'hushmail.com',
  'lycos.com',
  'web.de',
  'freenet.de',
  't-online.de',
  'cox.net',
  'comcast.net',
  'sbcglobal.net',
  'verizon.net',
  'att.net',
  'bellsouth.net',
  'charter.net',
  'earthlink.net',
  'inbox.com',
  'laposte.net',
  'orange.fr',
  'wanadoo.fr',
  'free.fr',
  'sfr.fr',
  'neuf.fr',
  'libero.it',
  'virgilio.it',
  'alice.it',
  'tin.it',
  'tiscali.it',
  'uol.com.br',
  'bol.com.br',
  'terra.com.br',
  'ig.com.br',

  // Disposable / Temporary Email Services
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'mailinator.com',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.net',
  'getairmail.com',
  'dispostable.com',
  'yopmail.com',
  'sharklasers.com',
  'grr.la',
  'guerrillamailblock.com',
  'pokemail.net',
  'spam4.me'
]);

/**
 * Validates if an email address belongs to a company / business domain
 * and rejects free / personal / disposable webmail domains.
 * 
 * @param {string} email 
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateCompanyEmail(email) {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email address is required.' };
  }

  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email format (e.g. name@company.com).' };
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Invalid email address structure.' };
  }

  const domain = parts[1];

  if (PERSONAL_EMAIL_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: `Personal email addresses (@${domain}) are not allowed. Please use your official corporate or company email address.`
    };
  }

  return { isValid: true };
}
