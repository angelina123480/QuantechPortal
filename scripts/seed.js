require('dotenv').config();
const { Client } = require('@neondatabase/serverless');
const { buildUsers } = require('../src/data/seed/users');
const { buildTickets } = require('../src/data/seed/tickets');
const { buildArticles } = require('../src/data/seed/articles');

async function seed() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('Clearing existing data...');
    await client.query('TRUNCATE TABLE ticket_history, attachments, tickets, users, articles CASCADE');
    await client.query('ALTER SEQUENCE ticket_number_seq RESTART WITH 126');

    const users = buildUsers();
    const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

    console.log(`Inserting ${users.length} users...`);
    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, name, email, password_hash, role, company, department, title, phone, notification_prefs, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [u.id, u.name, u.email, u.passwordHash, u.role, u.company, u.department, u.title, u.phone, JSON.stringify(u.notificationPrefs), u.createdAt]
      );
    }

    const tickets = buildTickets({ usersById });
    console.log(`Inserting ${tickets.length} tickets...`);
    for (const t of tickets) {
      await client.query(
        `INSERT INTO tickets (
           id, ticket_number, title, description, category, priority, status,
           affected_service, company, department, contact_name, contact_email, contact_phone,
           client_user_id, assigned_technician_id, due_at, created_at, updated_at, resolved_at, closed_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          t.id, t.ticketNumber, t.title, t.description, t.category, t.priority, t.status,
          t.affectedService, t.company, t.department, t.contactName, t.contactEmail, t.contactPhone,
          t.clientUserId, t.assignedTechnicianId, t.dueAt, t.createdAt, t.updatedAt, t.resolvedAt, t.closedAt,
        ]
      );

      for (const h of t.history) {
        await client.query(
          `INSERT INTO ticket_history (id, ticket_id, type, author_id, author_name, author_role, message, from_status, to_status, from_priority, to_priority, internal, occurred_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [h.id, t.id, h.type, h.authorId, h.authorName, h.authorRole, h.message, h.fromStatus, h.toStatus, h.fromPriority || null, h.toPriority || null, h.internal, h.timestamp]
        );
      }
    }

    const articles = buildArticles();
    console.log(`Inserting ${articles.length} articles...`);
    for (const a of articles) {
      await client.query(
        `INSERT INTO articles (id, title, category, summary, body, tags, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [a.id, a.title, a.category, a.summary, a.body, a.tags, a.updatedAt]
      );
    }

    console.log('Seed complete.');
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
