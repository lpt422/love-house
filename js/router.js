/**
 * 页面路由（支持浏览器/手机返回手势）
 * 主 Tab：home / checkin / album / notes
 * 次页面：checkin-detail、city（不归属任何 Tab）
 *
 * 说明：
 * - show() 写入浏览器历史（pushState），手机「返回」可在应用内回退；
 * - 首次进入主应用用 show(name, {replace:true})；
 * - 普通切换回到顶部；从打卡详情/城市目录「返回首页」时，回到「打卡记录」区域。
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

    // 页面内「返回」按钮：回退到上一页
    document.querySelectorAll('[data-back]').forEach(function (btn) {
      btn.addEventListener('click', function () { history.back(); });
    });

    // 浏览器/手机返回手势：回到历史里的上一页
    window.addEventListener('popstate', function (e) {
      var page = (e.state && e.state.page) || 'home';
      render(page, true);
    });

    if (history.scrollRestoration) history.scrollRestoration = 'manual';
  }

  function normalize(name) {
    if (!document.getElementById('page-' + name)) name = 'home';
    return name;
  }

  function show(name, opts) {
    name = normalize(name);
    if (name === current && !(opts && opts.replace)) { render(name, false); return; }
    current = name;
    try {
      if (opts && opts.replace) history.replaceState({ page: name }, '');
      else history.pushState({ page: name }, '');
    } catch (e) { /* 忽略 */ }
    render(name, false);
  }

  function render(name, fromPop) {
    name = normalize(name);
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

    // 返回首页时：回到「打卡记录」区域；其它情况回到顶部
    if (fromPop && name === 'home') {
      var target = document.getElementById('home-checkins') || document.getElementById('home-city-list');
      if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
      else scrollTop();
    } else {
      scrollTop();
    }
  }

  function scrollTop() {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }

  return { init: init, show: show, get current() { return current; } };
})();