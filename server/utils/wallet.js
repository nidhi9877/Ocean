import { sql } from '../db.js';

// ─── Reseller wallet ────────────────────────────────────────────────────────────
// Resellers prepay into a wallet. Each "Send Enquiry" click deducts a fixed price.
// No enquiry can be sent until the wallet has been activated by reaching the
// minimum initial recharge (default ₹500).
// Every balance change is a single SQL statement that updates the wallet and writes
// the ledger row together, so concurrent clicks can never overdraw the balance.

export const WALLET_DEFAULTS = {
  enquiry_price: 50,          // ₹ deducted per Send Enquiry click
  min_initial_recharge: 500,  // ₹ needed to activate the wallet
  min_topup: 100,             // ₹ minimum for later online top-ups
};

const money = (v) => Math.round(Number(v) * 100) / 100;

export async function getWalletSettings() {
  const rows = await sql`SELECT key, value FROM app_settings WHERE key IN ('enquiry_price', 'min_initial_recharge', 'min_topup')`;
  const out = { ...WALLET_DEFAULTS };
  for (const r of rows) {
    const n = Number(r.value);
    if (Number.isFinite(n) && n >= 0) out[r.key] = n;
  }
  return out;
}

export async function updateWalletSettings(patch) {
  const allowed = Object.keys(WALLET_DEFAULTS).filter(k => patch[k] !== undefined && patch[k] !== '');
  for (const key of allowed) {
    const n = money(patch[key]);
    if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid value for ${key}`);
    if (key === 'enquiry_price' && n <= 0) throw new Error('Enquiry price must be greater than 0');
    await sql`
      INSERT INTO app_settings (key, value) VALUES (${key}, ${String(n)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
  }
  return getWalletSettings();
}

export async function ensureWallet(userId) {
  await sql`INSERT INTO wallets (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`;
}

export async function getWallet(userId) {
  await ensureWallet(userId);
  const [w] = await sql`SELECT balance, activated_at, updated_at FROM wallets WHERE user_id = ${userId}`;
  return { balance: Number(w.balance), activated_at: w.activated_at, activated: !!w.activated_at, updated_at: w.updated_at };
}

export async function getTransactions(userId, limit = 50) {
  const rows = await sql`
    SELECT id, type, amount, balance_after, source, reference, note, created_at
    FROM wallet_transactions WHERE user_id = ${userId}
    ORDER BY created_at DESC, id DESC LIMIT ${limit}
  `;
  return rows.map(r => ({ ...r, amount: Number(r.amount), balance_after: Number(r.balance_after) }));
}

// Add money. `reference` (optional) makes the credit idempotent — the same payment
// can never be credited twice. Activates the wallet once the balance reaches the
// minimum initial recharge. Returns the ledger row, or null if `reference` was already used.
export async function creditWallet({ userId, amount, source, reference = null, note = null, createdBy = null }) {
  const amt = money(amount);
  if (!(amt > 0)) throw new Error('Amount must be greater than 0');
  const { min_initial_recharge } = await getWalletSettings();
  await ensureWallet(userId);
  let rows;
  try {
    rows = await creditStatement(userId, amt, min_initial_recharge, source, reference, note, createdBy);
  } catch (err) {
    // Same reference credited by a concurrent request — the unique index rejected it
    if (err.code === '23505' && reference) return null;
    throw err;
  }
  return rows[0] ? { ...rows[0], amount: Number(rows[0].amount), balance_after: Number(rows[0].balance_after) } : null;
}

export function creditStatement(userId, amt, min_initial_recharge, source, reference, note, createdBy) {
  return sql`
    WITH upd AS (
      UPDATE wallets
      SET balance = balance + ${amt},
          activated_at = COALESCE(activated_at, CASE WHEN balance + ${amt} >= ${min_initial_recharge} THEN NOW() END),
          updated_at = NOW()
      WHERE user_id = ${userId}
        AND (${reference}::text IS NULL OR NOT EXISTS (SELECT 1 FROM wallet_transactions WHERE reference = ${reference}))
      RETURNING balance
    )
    INSERT INTO wallet_transactions (user_id, type, amount, balance_after, source, reference, note, created_by)
    SELECT ${userId}, 'credit', ${amt}, upd.balance, ${source}, ${reference}, ${note}, ${createdBy} FROM upd
    RETURNING id, amount, balance_after, created_at
  `;
}

// Take money out. Fails (returns { ok: false, reason }) when the wallet is not activated
// or the balance is too low. `requireActivated` is false only for admin corrections.
export async function debitWallet({ userId, amount, source, reference = null, note = null, createdBy = null, requireActivated = true }) {
  const amt = money(amount);
  if (!(amt > 0)) throw new Error('Amount must be greater than 0');
  await ensureWallet(userId);
  const rows = await debitStatement(userId, amt, requireActivated, source, reference, note, createdBy);
  if (rows[0]) return { ok: true, tx: { ...rows[0], amount: Number(rows[0].amount), balance_after: Number(rows[0].balance_after) } };

  const w = await getWallet(userId);
  if (requireActivated && !w.activated) return { ok: false, reason: 'not_activated', wallet: w };
  return { ok: false, reason: 'insufficient_balance', wallet: w };
}

// Exported for tests: the single atomic statements behind credit / debit
export function debitStatement(userId, amt, requireActivated, source, reference, note, createdBy) {
  return sql`
    WITH upd AS (
      UPDATE wallets
      SET balance = balance - ${amt}, updated_at = NOW()
      WHERE user_id = ${userId} AND balance >= ${amt}
        AND (${requireActivated}::boolean = false OR activated_at IS NOT NULL)
      RETURNING balance
    )
    INSERT INTO wallet_transactions (user_id, type, amount, balance_after, source, reference, note, created_by)
    SELECT ${userId}, 'debit', ${amt}, upd.balance, ${source}, ${reference}, ${note}, ${createdBy} FROM upd
    RETURNING id, amount, balance_after, created_at
  `;
}
