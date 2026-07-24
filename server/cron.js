import cron from 'node-cron';
import { sql } from './db.js';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const SYSTEM_FROM = process.env.SYSTEM_EMAIL_FROM || 'Vortex Marketplace <onboarding@resend.dev>';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * The Surge Pricing Engine
 * Runs every 30 minutes.
 * Scans for pending inquiries older than 1 hour where the buyer hasn't been emailed yet.
 * Sends a FOMO/Surge email to the buyer urging them to increase the Target Price.
 */
export function initCronJobs() {
  console.log('⏳ Initializing Vortex Surge Pricing Engine (Cron Jobs)...');
  // Surge pricing disabled because Target Price feature was removed.
}
