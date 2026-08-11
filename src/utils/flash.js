function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

// Reads and clears the pending flash message; call once per request (in middleware).
function consumeFlash(req) {
  const flash = req.session.flash || null;
  if (flash) delete req.session.flash;
  return flash;
}

module.exports = { setFlash, consumeFlash };
