// Runs synchronously in <head>, before CSS is applied, so a previously chosen
// theme is stamped on <html> before first paint (no flash of the wrong theme).
// Absence of this attribute means "follow OS preference" and is left to CSS.
(function () {
  try {
    var stored = window.localStorage.getItem('qt-theme');
    if (stored === 'dark' || stored === 'light') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {
    // localStorage unavailable (private mode, etc.) — fall back to OS preference.
  }
})();
