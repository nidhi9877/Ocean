import { sql } from '../db.js';
import { sendInactivityWarningEmail, sendAccountFrozenEmail } from './email.js';

// ─── Seller inactivity discipline ───────────────────────────────────────────────
// 1. A seller who has not signed in for INACTIVITY_DAYS gets a warning email.
// 2. If they still haven't signed in GRACE_DAYS after the warning, the account is frozen:
//    their inventory is hidden from buyers/resellers and the seller area is locked
//    until management approves a reactivation request.
// The rule only starts once a seller has signed in MIN_LOGINS times (i.e. from their
// second login after registration). Signing in, confirming the inventory with the
// "Update Inventory" button, or being reactivated by management all count as activity.
export const INACTIVITY_DAYS = Number(process.env.SELLER_INACTIVITY_DAYS) || 7;
export const GRACE_DAYS = Number(process.env.SELLER_FREEZE_GRACE_DAYS) || 2;
export const MIN_LOGINS = 2;

export async function runSellerInactivityChecks() {
  const warned = await sql`
    UPDATE providers p SET inactivity_warned_at = NOW()
    FROM users u
    WHERE u.id = p.user_id
      AND COALESCE(p.status, 'approved') = 'approved'
      AND p.frozen_at IS NULL
      AND p.inactivity_warned_at IS NULL
      AND COALESCE(u.login_count, 0) >= ${MIN_LOGINS}
      AND GREATEST(u.last_login_at, p.activity_reset_at, p.inventory_verified_at) < NOW() - make_interval(days => ${INACTIVITY_DAYS})
    RETURNING p.email, p.company_name, u.username, p.inactivity_warned_at
  `;
  for (const s of warned) {
    const deadline = new Date(new Date(s.inactivity_warned_at).getTime() + GRACE_DAYS * 86400000);
    await sendInactivityWarningEmail({ to: s.email, username: s.username, companyName: s.company_name, inactiveDays: INACTIVITY_DAYS, deadline })
      .catch(err => console.error(`[Seller Inactivity] Warning email failed for ${s.email}:`, err.message));
  }

  // Freeze only if there was no activity at all since the warning was sent
  const frozen = await sql`
    UPDATE providers p SET frozen_at = NOW(), unfreeze_requested_at = NULL, unfreeze_note = NULL
    FROM users u
    WHERE u.id = p.user_id
      AND p.frozen_at IS NULL
      AND p.inactivity_warned_at IS NOT NULL
      AND p.inactivity_warned_at < NOW() - make_interval(days => ${GRACE_DAYS})
      AND COALESCE(GREATEST(u.last_login_at, p.activity_reset_at, p.inventory_verified_at), '-infinity'::timestamptz) < p.inactivity_warned_at
    RETURNING p.email, p.company_name, u.username
  `;
  for (const s of frozen) {
    await sendAccountFrozenEmail({ to: s.email, username: s.username, companyName: s.company_name })
      .catch(err => console.error(`[Seller Inactivity] Freeze email failed for ${s.email}:`, err.message));
  }

  if (warned.length || frozen.length) {
    console.log(`[Seller Inactivity] Warned ${warned.length}, froze ${frozen.length} seller account(s).`);
  }
  return { warned: warned.length, frozen: frozen.length };
}

// Seller's own freeze state (used by the seller area and the request guard)
export async function getFreezeStatus(userId) {
  const [p] = await sql`
    SELECT id, company_name, frozen_at, unfreeze_requested_at, inactivity_warned_at, inventory_verified_at
    FROM providers WHERE user_id = ${userId}
  `;
  if (!p) return null;
  return {
    providerId: p.id,
    frozen: !!p.frozen_at,
    frozenAt: p.frozen_at,
    unfreezeRequestedAt: p.unfreeze_requested_at,
    warnedAt: p.inactivity_warned_at,
    freezeDeadline: p.inactivity_warned_at ? new Date(new Date(p.inactivity_warned_at).getTime() + GRACE_DAYS * 86400000) : null,
    inventoryVerifiedAt: p.inventory_verified_at,
  };
}
