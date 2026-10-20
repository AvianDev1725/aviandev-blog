import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';

async function main() {
  await db.execute(sql`
    update users
    set first_name = split_part(name, ' ', 1),
        last_name = nullif(regexp_replace(name, '^[^ ]+ *', ''), '')
    where first_name is null
  `);

  await db.execute(sql`
    update users
    set email_verified_at = now()
    where email_verified_at is null and role <> 'reader'
  `);

  console.log('Existing users updated.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});