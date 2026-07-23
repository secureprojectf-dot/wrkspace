import 'dotenv/config';
import pg from 'pg';

const q = (process.argv[2] || 'padarthidhanush').toLowerCase();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query(
	`SELECT id, email, "firstName", "lastName", gender
   FROM "Employee"
   WHERE LOWER(email) LIKE $1
      OR LOWER("firstName") LIKE $1
      OR LOWER("lastName") LIKE $1
   ORDER BY email`,
	[`%${q}%`],
);
console.log('matches', rows);

if (!rows.length) {
	console.error('No employee matched', q);
	process.exit(1);
}

const target =
	rows.find((r) => String(r.email || '').toLowerCase().includes('padarthidhanush')) ||
	rows.find((r) => String(r.email || '').toLowerCase().includes('padarthi')) ||
	rows[0];

const updated = await pool.query(
	`UPDATE "Employee" SET gender = 'FEMALE' WHERE id = $1
   RETURNING id, email, "firstName", "lastName", gender`,
	[target.id],
);
console.log('updated', updated.rows[0]);
await pool.end();
