// Apply saved theme immediately to avoid flash of incorrect theme
(function() {
  try {
    var theme = localStorage.getItem('theme');
    if (theme === 'Dark') {
      document.documentElement.classList.add('dark');
      if (document.body) document.body.classList.add('dark');
    } else if (theme === 'Light') {
      document.documentElement.classList.remove('dark');
      if (document.body) document.body.classList.remove('dark');
    }
  } catch (e) {
    // ignore
  }
})();
