function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
      if (tab === 'registry')  registryModule.load();
      if (tab === 'dashboard') dashboardModule.load();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  generatorModule.init();
  registryModule.init();
  dashboardModule.init();
});
