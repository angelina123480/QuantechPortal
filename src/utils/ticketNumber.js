/**
 * Generates sequential QuanTech ticket numbers, e.g. QNT-2026-00124.
 * The counter resets implicitly whenever the year in `year` changes,
 * mirroring how a real per-year sequence column would behave in Postgres.
 */
function createTicketNumberGenerator(startingCounter = 0) {
  let counter = startingCounter;

  return function generate(date = new Date()) {
    counter += 1;
    const year = date.getFullYear();
    const padded = String(counter).padStart(5, '0');
    return `QNT-${year}-${padded}`;
  };
}

module.exports = { createTicketNumberGenerator };
