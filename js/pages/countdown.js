/**
 * 倒计时页：在一起总时长（每秒跳动）+ 各个纪念日倒计时
 */
App.pages = App.pages || {};
App.pages.countdown = (function () {

  var timer = null;

  function init() {
    App.store.on('room', render);
    App.store.on('anniversaries', renderAnniversaries);

    // 每秒刷新一次"在一起"的实时时长
    timer = setInterval(function () {
      var page = document.getElementById('page-countdown');
      if (page && !page.classList.contains('hidden')) renderBig();
    }, 1000);
  }

  function onShow() { render(); }

  function render() {
    renderBig();
    renderAnniversaries();
  }

  /** 在一起 X 天 X 时 X 分 X 秒 */
  function renderBig() {
    var s = App.store.state;
    var start = (s.room && s.room.startDate) ? App.utils.parseDate(s.room.startDate) : null;
    if (!start) {
      document.getElementById('cd-days').textContent = '--';
      document.getElementById('cd-hours').textContent = '0';
      document.getElementById('cd-minutes').textContent = '0';
      document.getElementById('cd-seconds').textContent = '0';
      document.getElementById('cd-since').textContent = '在右上角 ⚙️ 里设置在一起的日子';
      return;
    }
    var now = new Date();
    var diff = Math.max(0, now.getTime() - start.getTime());
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    var secs = Math.floor((diff % 60000) / 1000);
    document.getElementById('cd-days').textContent = days;
    document.getElementById('cd-hours').textContent = hours;
    document.getElementById('cd-minutes').textContent = mins;
    document.getElementById('cd-seconds').textContent = secs;
    document.getElementById('cd-since').textContent = '从 ' + s.room.startDate + ' 开始 💗';
  }

  /** 各纪念日距离下一次还有多久 */
  function renderAnniversaries() {
    var box = document.getElementById('cd-anniversaries');
    var list = App.store.state.anniversaries;
    if (!list.length) {
      box.innerHTML = '<p class="text-rose-400 text-sm">还没有纪念日，去「纪念日」页面添加吧～</p>';
      return;
    }
    box.innerHTML = list.map(function (a) {
      if (!a.date) return '';
      var next = App.utils.nextOccurrence(a.date);
      var days = Math.round((next.getTime() - new Date().getTime()) / 86400000);
      var label = days === 0 ? '就是今天 🎉' : (days === 1 ? '明天 💗' : days + ' 天');
      return '<div class="flex items-center justify-between bg-rose-50/70 rounded-2xl px-4 py-3">' +
        '<div class="min-w-0">' +
          '<p class="font-medium text-rose-700 truncate">🎀 ' + App.utils.esc(a.title) + '</p>' +
          '<p class="text-xs text-rose-300">📅 ' + App.utils.esc(a.date) + (a.note ? ' · ' + App.utils.esc(a.note) : '') + '</p>' +
        '</div>' +
        '<span class="text-rose-500 font-bold whitespace-nowrap ml-3">' + label + '</span>' +
      '</div>';
    }).join('');
  }

  return { init: init, onShow: onShow };
})();