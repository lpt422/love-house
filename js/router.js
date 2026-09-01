/**
 * 页面路由：首页 / 倒计时 / 日记 / 相册 / 纪念日 / 留言板
 * 顶部 tab 与底部 tab 共用 data-tab 切换
 */
window.App = window.App || {};

App.router = (function () {
  var TABS = ['home', 'countdown', 'diary', 'photos', 'anniversary', 'message'];
  var current = 'home';

  function init() {
    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { show(btn.dataset.tab); });
    });
  }

  function show(name) {
    if (TABS.indexOf(name) < 0) name = 'home';
    current = name;

    // 切换页面区块
    document.querySelectorAll('.page').forEach(function (p) { p.classList.add('hidden'); });
    var page = document.getElementById('page-' + name);
    if (page) page.classList.remove('hidden');

    // 高亮导航按钮（顶栏 + 底栏一起处理）
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.classList.toggle('active-tab', b.dataset.tab === name);
    });

    // 通知页面做"进入时"处理（例如倒计时页面刷新时间）
    var p = App.pages[name];
    if (p && p.onShow) { try { p.onShow(); } catch (e) { console.error(e); } }

    window.scrollTo({ top: 0 });
  }

  return { init: init, show: show, get current() { return current; } };
})();