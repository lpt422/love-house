/**
 * 页面路由
 * 主 Tab：home(首页) / checkin(打卡) / album(相册) / notes(日记·留言)
 * 次页面：checkin-detail（打卡详情，不归属任何 Tab）
 */
window.App = window.App || {};

App.router = (function () {
  var PRIMARY = ['home', 'checkin', 'album', 'notes'];
  var SUB_OF = { 'checkin-detail': null, city: null };
  var current = 'home';

  function init() {
    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { show(btn.dataset.tab); });
    });
  }

  function show(name) {
    if (!document.getElementById('page-' + name)) name = 'home';
    current = name;

    document.querySelectorAll('.page').forEach(function (p) { p.classList.add('hidden'); });
    var page = document.getElementById('page-' + name);
    if (page) page.classList.remove('hidden');

    var active = PRIMARY.indexOf(name) >= 0 ? name : (SUB_OF[name] || null);
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.classList.toggle('active-tab', b.dataset.tab === active);
    });

    var p = App.pages[name];
    if (p && p.onShow) { try { p.onShow(); } catch (e) { console.error(e); } }

    window.scrollTo({ top: 0 });
  }

  return { init: init, show: show, get current() { return current; } };
})();