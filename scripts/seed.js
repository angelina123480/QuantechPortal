require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { Client } = require('@neondatabase/serverless');
const { buildDepartments } = require('../src/data/seed/departments');
const { buildTeams } = require('../src/data/seed/teams');
const { buildCompanies } = require('../src/data/seed/companies');
const { buildCategories } = require('../src/data/seed/categories');
const { buildUsers } = require('../src/data/seed/users');
const { buildTickets } = require('../src/data/seed/tickets');
const { buildArticles } = require('../src/data/seed/articles');
const { buildPermissions, buildRolePermissions } = require('../src/data/seed/permissions');
const { buildSlaPolicies, buildSystemSettings } = require('../src/data/seed/slaPolicies');
const { buildCannedResponses } = require('../src/data/seed/cannedResponses');
const { buildAssignmentRules } = require('../src/data/seed/assignmentRules');

const TABLES_IN_TRUNCATE_ORDER = [
  'audit_logs', 'notifications', 'sla_events', 'escalations', 'ticket_ratings', 'ticket_links',
  'attachments', 'ticket_history', 'tickets', 'assignment_rules', 'canned_responses',
  'password_reset_tokens', 'role_permissions', 'permissions', 'articles', 'subcategories',
  'categories', 'system_settings', 'sla_policies', 'users', 'teams', 'companies', 'departments',
];

async function seed() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('Clearing existing data...');
    await client.query(`TRUNCATE TABLE ${TABLES_IN_TRUNCATE_ORDER.join(', ')} CASCADE`);

    // ---------- Departments ----------
    const departments = buildDepartments();
    console.log(`Inserting ${departments.length} departments...`);
    for (const d of departments) {
      await client.query('INSERT INTO departments (id, name, description, created_at) VALUES ($1,$2,$3,$4)', [d.id, d.name, d.description, d.createdAt]);
    }

    // ---------- Teams (lead_user_id filled in after users exist) ----------
    const teams = buildTeams();
    console.log(`Inserting ${teams.length} teams...`);
    for (const t of teams) {
      await client.query('INSERT INTO teams (id, name, department_id, lead_user_id, created_at) VALUES ($1,$2,$3,NULL,$4)', [t.id, t.name, t.departmentId, t.createdAt]);
    }

    // ---------- Companies ----------
    const companies = buildCompanies();
    console.log(`Inserting ${companies.length} companies...`);
    for (const c of companies) {
      await client.query(
        'INSERT INTO companies (name, contact_name, contact_email, contact_phone, industry, team_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [c.name, c.contactName, c.contactEmail, c.contactPhone, c.industry, c.teamId, c.createdAt]
      );
    }

    // ---------- Categories & Subcategories ----------
    const { categories, subcategories } = buildCategories();
    console.log(`Inserting ${categories.length} categories, ${subcategories.length} subcategories...`);
    for (const cat of categories) {
      await client.query('INSERT INTO categories (name, description, created_at) VALUES ($1,$2,$3)', [cat.name, cat.description, cat.createdAt]);
    }
    for (const sub of subcategories) {
      await client.query('INSERT INTO subcategories (id, category_name, name) VALUES ($1,$2,$3)', [sub.id, sub.categoryName, sub.name]);
    }
    const subcategoryIdByCategoryAndName = new Map(subcategories.map((s) => [`${s.categoryName}::${s.name}`, s.id]));

    // ---------- Users ----------
    const users = buildUsers();
    const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
    console.log(`Inserting ${users.length} users...`);
    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, name, email, password_hash, role, company, department, title, phone, notification_prefs, created_at, team_id, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [u.id, u.name, u.email, u.passwordHash, u.role, u.company, u.department, u.title, u.phone, JSON.stringify(u.notificationPrefs), u.createdAt, u.teamId, u.isActive]
      );
    }

    console.log('Linking team leaders...');
    for (const t of teams) {
      await client.query('UPDATE teams SET lead_user_id = $1 WHERE id = $2', [t.leadUserId, t.id]);
    }

    // ---------- Tickets + history + attachments + ratings ----------
    const tickets = buildTickets({ usersById });

    // Merge demo: mark the second ticket in the duplicate pair (QNT-2026-00238)
    // as a duplicate of the first (QNT-2026-00237) and auto-close it, the way
    // the ticket-merge feature behaves at runtime.
    const canonical = tickets.find((t) => t.ticketNumber === 'QNT-2026-00237');
    const duplicate = tickets.find((t) => t.ticketNumber === 'QNT-2026-00238');
    if (canonical && duplicate) {
      const mergedAt = new Date();
      duplicate.status = 'Closed';
      duplicate.resolvedAt = mergedAt;
      duplicate.closedAt = mergedAt;
      duplicate.updatedAt = mergedAt;
      duplicate.history.push({
        id: `h${9000}`,
        type: 'status_change',
        authorId: usersById.u23.id,
        authorName: usersById.u23.name,
        authorRole: usersById.u23.role,
        message: `Merged into ${canonical.ticketNumber} as a duplicate.`,
        fromStatus: 'Open',
        toStatus: 'Closed',
        internal: false,
        timestamp: mergedAt,
      });
    }

    console.log(`Inserting ${tickets.length} tickets...`);
    const notifications = [];
    const auditLogs = [];
    let notifSeq = 1;
    let auditSeq = 1;

    for (const t of tickets) {
      const subcategoryId = t.subcategoryName ? subcategoryIdByCategoryAndName.get(`${t.category}::${t.subcategoryName}`) : null;
      await client.query(
        `INSERT INTO tickets (
           id, ticket_number, title, description, category, subcategory_id, priority, status,
           affected_service, company, client_department, contact_name, contact_email, contact_phone,
           client_user_id, assigned_technician_id, team_id, due_at, created_at, updated_at, resolved_at, closed_at, first_response_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [
          t.id, t.ticketNumber, t.title, t.description, t.category, subcategoryId, t.priority, t.status,
          t.affectedService, t.company, t.clientDepartment, t.contactName, t.contactEmail, t.contactPhone,
          t.clientUserId, t.assignedTechnicianId, t.teamId, t.dueAt, t.createdAt, t.updatedAt, t.resolvedAt, t.closedAt, t.firstResponseAt,
        ]
      );

      for (const h of t.history) {
        await client.query(
          `INSERT INTO ticket_history (id, ticket_id, type, author_id, author_name, author_role, message, from_status, to_status, from_priority, to_priority, internal, occurred_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [h.id, t.id, h.type, h.authorId, h.authorName, h.authorRole, h.message, h.fromStatus, h.toStatus, h.fromPriority || null, h.toPriority || null, h.internal, h.timestamp]
        );
      }

      if (t.rating) {
        const feedback = t.rating.stars === 5 ? 'Great support, resolved quickly!' : t.rating.stars === 3 ? 'Got there eventually.' : null;
        await client.query(
          'INSERT INTO ticket_ratings (id, ticket_id, client_user_id, stars, feedback, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
          [uuidv4(), t.id, t.clientUserId, t.rating.stars, feedback, t.closedAt || t.resolvedAt || t.updatedAt]
        );
      }

      if (t.assignedTechnicianId) {
        notifications.push({
          id: `n${notifSeq++}`, userId: t.assignedTechnicianId, type: 'ticket_assigned',
          title: `Ticket assigned: ${t.ticketNumber}`, body: t.title, ticketId: t.id,
          isRead: Math.random() > 0.5, createdAt: t.createdAt,
        });
        auditLogs.push({
          id: `al${auditSeq++}`, userId: usersById.u23.id, userName: usersById.u23.name, action: 'ticket.assign',
          entityType: 'ticket', entityId: t.id, beforeValue: { assignedTechnicianId: null }, afterValue: { assignedTechnicianId: t.assignedTechnicianId }, createdAt: t.createdAt,
        });
      }
      if (t.resolvedAt) {
        notifications.push({
          id: `n${notifSeq++}`, userId: t.clientUserId, type: 'ticket_resolved',
          title: `Ticket resolved: ${t.ticketNumber}`, body: t.title, ticketId: t.id,
          isRead: Math.random() > 0.5, createdAt: t.resolvedAt,
        });
        auditLogs.push({
          id: `al${auditSeq++}`, userId: t.assignedTechnicianId, userName: t.assignedTechnicianId ? usersById[t.assignedTechnicianId].name : null, action: 'ticket.status_change',
          entityType: 'ticket', entityId: t.id, beforeValue: { status: 'In Progress' }, afterValue: { status: 'Resolved' }, createdAt: t.resolvedAt,
        });
      }
      if (t.status === 'Escalated') {
        const team = teams.find((tm) => tm.id === t.teamId);
        await client.query(
          'INSERT INTO escalations (id, ticket_id, reason, escalated_by, escalated_to_team_id, note, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [uuidv4(), t.id, 'manual', t.assignedTechnicianId, t.teamId, 'Escalating to the team leader — needs additional resources given priority and blast radius.', t.updatedAt]
        );
        await client.query(
          'INSERT INTO sla_events (id, ticket_id, event_type, occurred_at, meta) VALUES ($1,$2,$3,$4,$5)',
          [uuidv4(), t.id, 'escalated', t.updatedAt, JSON.stringify({ reason: 'manual' })]
        );
        notifications.push({
          id: `n${notifSeq++}`, userId: team.leadUserId, type: 'ticket_escalated',
          title: `Ticket escalated: ${t.ticketNumber}`, body: t.title, ticketId: t.id,
          isRead: false, createdAt: t.updatedAt,
        });
        auditLogs.push({
          id: `al${auditSeq++}`, userId: t.assignedTechnicianId, userName: usersById[t.assignedTechnicianId].name, action: 'ticket.escalate',
          entityType: 'ticket', entityId: t.id, beforeValue: { status: 'In Progress' }, afterValue: { status: 'Escalated' }, createdAt: t.updatedAt,
        });
      }
    }

    if (canonical && duplicate) {
      await client.query(
        'INSERT INTO ticket_links (id, ticket_id, linked_ticket_id, link_type, created_by, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [uuidv4(), duplicate.id, canonical.id, 'duplicate', usersById.u23.id, duplicate.updatedAt]
      );
    }

    console.log(`Inserting ${notifications.length} notifications...`);
    for (const n of notifications) {
      await client.query(
        'INSERT INTO notifications (id, user_id, type, title, body, ticket_id, is_read, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [n.id, n.userId, n.type, n.title, n.body, n.ticketId, n.isRead, n.createdAt]
      );
    }

    console.log(`Inserting ${auditLogs.length} audit log rows...`);
    for (const a of auditLogs) {
      await client.query(
        'INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, before_value, after_value, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [a.id, a.userId, a.userName, a.action, a.entityType, a.entityId, JSON.stringify(a.beforeValue), JSON.stringify(a.afterValue), a.createdAt]
      );
    }
    // A few login events to show audit logs aren't ticket-only.
    for (const u of [usersById.u23, usersById.u8, usersById.u1]) {
      await client.query(
        'INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [uuidv4(), u.id, u.name, 'auth.login', 'user', u.id, new Date(Date.now() - Math.random() * 48 * 60 * 60 * 1000)]
      );
    }

    await client.query('ALTER SEQUENCE ticket_number_seq RESTART WITH 239');

    // ---------- Knowledge base articles ----------
    const articles = buildArticles();
    console.log(`Inserting ${articles.length} articles...`);
    for (const a of articles) {
      await client.query(
        'INSERT INTO articles (id, title, category, summary, body, tags, updated_at, status, author_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [a.id, a.title, a.category, a.summary, a.body, a.tags, a.updatedAt, 'published', usersById.u23.id]
      );
    }

    // ---------- Permissions & role defaults ----------
    const permissions = buildPermissions();
    console.log(`Inserting ${permissions.length} permissions...`);
    for (const p of permissions) {
      await client.query('INSERT INTO permissions (key, label, description) VALUES ($1,$2,$3)', [p.key, p.label, p.description]);
    }
    const rolePermissions = buildRolePermissions();
    for (const rp of rolePermissions) {
      await client.query('INSERT INTO role_permissions (role, permission_key) VALUES ($1,$2)', [rp.role, rp.permissionKey]);
    }

    // ---------- SLA policies & system settings ----------
    const slaPolicies = buildSlaPolicies();
    console.log(`Inserting ${slaPolicies.length} SLA policies...`);
    for (const sp of slaPolicies) {
      await client.query('INSERT INTO sla_policies (priority, response_minutes, resolution_minutes, updated_at) VALUES ($1,$2,$3,$4)', [sp.priority, sp.responseMinutes, sp.resolutionMinutes, sp.updatedAt]);
    }
    const systemSettings = buildSystemSettings();
    for (const s of systemSettings) {
      await client.query('INSERT INTO system_settings (key, value, updated_at) VALUES ($1,$2,$3)', [s.key, JSON.stringify(s.value), s.updatedAt]);
    }

    // ---------- Canned responses ----------
    const cannedResponses = buildCannedResponses();
    console.log(`Inserting ${cannedResponses.length} canned responses...`);
    for (const cr of cannedResponses) {
      await client.query(
        'INSERT INTO canned_responses (id, title, body, category, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [cr.id, cr.title, cr.body, cr.category, usersById.u23.id, cr.createdAt, cr.updatedAt]
      );
    }

    // ---------- Assignment rules ----------
    const assignmentRules = buildAssignmentRules();
    console.log(`Inserting ${assignmentRules.length} assignment rules...`);
    for (const r of assignmentRules) {
      await client.query(
        'INSERT INTO assignment_rules (id, name, category, priority, department_id, team_id, agent_id, is_active, sort_order, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [r.id, r.name, r.category, r.priority, r.departmentId, r.teamId, r.agentId, r.isActive, r.sortOrder, r.createdAt]
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
