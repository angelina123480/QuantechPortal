const { buildUsers } = require('./seed/users');
const { buildTickets } = require('./seed/tickets');
const { buildArticles } = require('./seed/articles');
const { createTicketNumberGenerator } = require('../utils/ticketNumber');

/**
 * Single in-memory "database". Every field/shape here is intentionally
 * close to what the equivalent Postgres tables would look like, so the
 * src/models/* layer is the only place that would need to change if this
 * were swapped for real queries later.
 */
function createStore() {
  const users = buildUsers();
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
  const tickets = buildTickets({ usersById });
  const articles = buildArticles();

  return {
    users,
    tickets,
    articles,
    nextUserSeq: users.length + 1,
    nextTicketSeq: tickets.length + 1,
    nextHistorySeq: tickets.reduce((max, t) => max + t.history.length, 0) + 1,
    generateTicketNumber: createTicketNumberGenerator(tickets.length + 110), // continue after seeded 00110-00124
  };
}

const store = createStore();

module.exports = store;
