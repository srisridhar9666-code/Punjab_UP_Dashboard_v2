// Applies the saved theme before first paint (kept out of index.html so a strict CSP needs no inline script).
try {
  var t = localStorage.getItem('theme') || 'system'
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
} catch (e) {}
