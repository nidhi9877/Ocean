import { Router } from 'express';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import { getWallet, getWalletSettings, getTransactions, creditWallet } from '../utils/wallet.js';

// ─── Reseller wallet API ────────────────────────────────────────────────────────
// Online recharge uses Razorpay Checkout. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
// in server/.env; without them only admin top-ups are available.
const router = Router();

function requireReseller(req, res, next) {
  if (req.user?.role !== 'reseller') return res.status(403).json({ error: 'Wallet is available for reseller accounts only.' });
  next();
}

router.use(authenticateToken, requireReseller);

const razorpayKeys = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return keyId && keySecret ? { keyId, keySecret } : null;
};

async function razorpay(path, { method = 'GET', body } = {}) {
  const { keyId, keySecret } = razorpayKeys();
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.description || `Razorpay request failed (${res.status})`);
  return data;
}

// Balance, pricing and recent history
router.get('/', async (req, res) => {
  try {
    const [wallet, settings, transactions] = await Promise.all([
      getWallet(req.user.id), getWalletSettings(), getTransactions(req.user.id, 50),
    ]);
    const keys = razorpayKeys();
    res.json({
      wallet,
      settings,
      transactions,
      onlinePayment: keys ? { provider: 'razorpay', keyId: keys.keyId } : null,
      // Minimum the reseller must pay right now
      minRecharge: wallet.activated ? settings.min_topup : Math.max(settings.min_initial_recharge - wallet.balance, 1),
    });
  } catch (error) {
    console.error('Error loading wallet:', error);
    res.status(500).json({ error: 'Failed to load wallet' });
  }
});

// Step 1 — create a Razorpay order for the chosen amount (₹)
router.post('/razorpay/order', async (req, res) => {
  try {
    if (!razorpayKeys()) return res.status(503).json({ error: 'Online payment is not configured yet. Please contact support to recharge your wallet.' });
    const amount = Math.round(Number(req.body.amount) * 100) / 100;
    const [wallet, settings] = await Promise.all([getWallet(req.user.id), getWalletSettings()]);
    const min = wallet.activated ? settings.min_topup : Math.max(settings.min_initial_recharge - wallet.balance, 1);
    if (!Number.isFinite(amount) || amount < min) {
      return res.status(400).json({ error: `Minimum recharge is ₹${min}${wallet.activated ? '' : ' to activate your wallet'}.` });
    }
    if (amount > 500000) return res.status(400).json({ error: 'Maximum recharge is ₹5,00,000 at a time.' });

    const order = await razorpay('/orders', {
      method: 'POST',
      body: {
        amount: Math.round(amount * 100), // paise
        currency: 'INR',
        receipt: `wallet_${req.user.id}_${Date.now()}`,
        notes: { user_id: String(req.user.id), username: req.user.username, purpose: 'MarineStockHub wallet recharge' },
      },
    });
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: razorpayKeys().keyId });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(502).json({ error: 'Could not start the payment. Please try again.' });
  }
});

// Step 2 — verify the Checkout signature, then credit the wallet with the order amount.
// The amount is read from Razorpay, never from the browser. One order = one credit.
router.post('/razorpay/verify', async (req, res) => {
  try {
    const keys = razorpayKeys();
    if (!keys) return res.status(503).json({ error: 'Online payment is not configured.' });
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (!orderId || !paymentId || !signature) return res.status(400).json({ error: 'Missing payment details.' });

    const expected = crypto.createHmac('sha256', keys.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    const valid = expected.length === String(signature).length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
    if (!valid) return res.status(400).json({ error: 'Payment verification failed.' });

    const order = await razorpay(`/orders/${orderId}`);
    if (String(order.notes?.user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'This payment belongs to a different account.' });
    }

    const amount = order.amount / 100;
    const tx = await creditWallet({
      userId: req.user.id,
      amount,
      source: 'razorpay',
      reference: `razorpay:${orderId}`,
      note: `Online recharge (payment ${paymentId})`,
    });
    const wallet = await getWallet(req.user.id);
    res.json({
      message: tx ? `₹${amount.toLocaleString('en-IN')} added to your wallet.` : 'This payment was already added to your wallet.',
      wallet,
    });
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error);
    res.status(500).json({ error: 'Payment received but the wallet could not be updated. Please contact support with your payment ID.' });
  }
});

export default router;
