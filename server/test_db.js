import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_QCavlu0qwN9i@ep-winter-frog-a118lqq9-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');
sql`SELECT 1`.then(console.log).catch(console.error);
