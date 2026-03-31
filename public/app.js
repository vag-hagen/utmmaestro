function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  location.hash = tab;
  if (tab === 'registry')  registryModule.load();
  if (tab === 'dashboard') dashboardModule.load();
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  window.addEventListener('hashchange', () => {
    const tab = location.hash.slice(1);
    if (tab && document.getElementById(`tab-${tab}`)) switchTab(tab);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  generatorModule.init();
  registryModule.init();
  dashboardModule.init();
  const hash = location.hash.slice(1);
  if (hash && document.getElementById(`tab-${hash}`)) switchTab(hash);
});
