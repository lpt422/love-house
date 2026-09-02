/**
 * 首页：
 * 1) 顶部保留最初的情侣天数卡片 UI（问候语 + 在一起天数 + 情话）
 * 2) 下方是旅行打卡总览（纪念日由 anniversary.js 负责展示在首页）
 */
App.pages = App.pages || {};
App.pages.home = (function () {

  var LOVE_WORDS = [
    '遇见你之后，我的每一天都多了一颗糖。🍬',
    '世界很大，可我的温柔只想给你一个人。🌷',
    '和你在一起，连发呆都变得有趣。💫',
    '你是我的「刚刚好」，不多不少。💗',
    '想陪你从清晨到日暮，从青丝到白头。🌙',
    '把喜欢写进风里，让全世界都知道。🍃',
    '你的名字，是我读过最短的情诗。📜',
    '晚风和你，都让我心动。🌙',
    '所谓浪漫，就是和你一起慢慢浪费时间。⏳',
    '我的心里，早就给你留好了位置。❤️'
  ];
  var curWord = -1;

  function init() {
    document.getElementById('home-quick-add').addEventListener('click', function () {
      App.pages.checkin.openNew();
    });

    document.getElementById('home-city-list').addEventListener('click', function (e) {
      var el = e.target.closest('[data-checkin-id]');
      if (el) App.pages['checkin-detail'].open(el.dataset.checkinId);
    });

    // 情话卡片：点击换一句
    document.getElementById('btn-love-word').addEventListener('click', function () {
      var i;
      do { i = Math.floor(Math.random() * LOVE_WORDS.length); } while (i === curWord && LOVE_WORDS.length > 1);
      curWord = i;
      document.getElementById('home-love-word').textContent = '“' + LOVE_WORDS[i] + '”';
    });

    App.store.on('checkins', render);
    App.store.on('photos', render);
    App.store.on('all', render);
  }

  function onShow() { render(); }

  function render() {
    var s = App.store.state;
    if (!s.roomId) return;

    renderCoupleCard();
    document.getElementById('home-city-count').textContent = s.checkins.length;
    document.getElementById('home-photo-count').textContent = s.photos.length;
    renderCityList();
    renderMap();
  }

  /** 顶部情侣天数卡片（保留原始 UI 与文案） */
  function renderCoupleCard() {
    var s = App.store.state;

    var other = s.members.find(function (m) { return m.id !== s.profile.id; });
    var myName = s.profile.name || '我';
    document.getElementById('home-greeting').textContent = other
      ? ('今天也要一起加油呀，' + other.name + ' 和 ' + myName)
      : '等待 TA 加入房间…';
    document.getElementById('home-hello').textContent = other
      ? ('Hi，' + other.name + ' 💕')
      : ('Hi，' + myName + ' 💕');

    if (s.room && s.room.startDate) {
      var start = App.utils.parseDate(s.room.startDate);
      var days = App.utils.daysDiff(new Date(), start);
      document.getElementById('home-days').textContent = days >= 0 ? days : 0;
      document.getElementById('home-since').textContent = '从 ' + s.room.startDate + ' 开始，一路有你';
    } else {
      document.getElementById('home-days').textContent = '--';
      document.getElementById('home-since').textContent = '还没有设置在一起的日子（右上角 ⚙️）';
    }

    if (curWord === -1) {
      curWord = Math.floor(Math.random() * LOVE_WORDS.length);
      document.getElementById('home-love-word').textContent = '“' + LOVE_WORDS[curWord] + '”';
    }
  }

  /** 打卡城市卡片列表 */
  function renderCityList() {
    var box = document.getElementById('home-city-list');
    var list = App.store.state.checkins;
    if (!list.length) {
      box.innerHTML = '<div class="col-span-full text-center py-8 text-slate-400">还没有点亮任何城市，点上方「新增打卡」开始记录吧 🧭</div>';
      return;
    }
    box.innerHTML = list.map(function (c) {
      var thumb = firstPhoto(c.id);
      var place = [c.province, c.country].filter(Boolean).join(' · ');
      return '<button type="button" data-checkin-id="' + App.utils.esc(c.id) + '" class="card p-3 text-left group">' +
        '<div class="flex gap-3">' +
          '<div class="w-20 h-20 rounded-2xl overflow-hidden bg-sky-50 shrink-0 flex items-center justify-center">' +
            (thumb ? '<img src="' + App.utils.esc(thumb) + '" class="w-full h-full object-cover" alt="">' : '<span class="text-2xl">🏙️</span>') +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<p class="font-semibold text-teal-700 truncate">📍 ' + App.utils.esc(c.cityName) + '</p>' +
            '<p class="text-xs text-slate-400 mt-1 truncate">' + App.utils.esc(place || '') + '</p>' +
            '<p class="text-xs text-slate-400 mt-1">🕐 ' + App.utils.esc(c.visitDate || '未填日期') + '</p>' +
          '</div>' +
        '</div></button>';
    }).join('');
  }

  /** 中国地图：已打卡城市高亮 */
  function renderMap() {
    var box = document.getElementById('home-map');
    var M = App.chinaMap;
    var W = M.W, H = M.H;

    var visited = {};
    var litProvinces = {};
    App.store.state.checkins.forEach(function (c) {
      visited[c.cityName] = true;
      var prov = c.province || (App.cityMap[c.cityName] && App.cityMap[c.cityName].province) || '';
      if (prov) litProvinces[prov] = true;
    });

    var paths = M.provinces.map(function (p) {
      var lit = !!litProvinces[p.name];
      return '<path d="' + p.d + '" fill="' + (lit ? '#99f6e4' : '#f8fafc') + '" stroke="#cbd5e1" stroke-width="1"/>';
    }).join('');

    var dots = [];
    App.cities.forEach(function (city) {
      if (visited[city.name]) return;
      var pt = M.project(city.lon, city.lat);
      dots.push('<circle cx="' + pt.x + '" cy="' + pt.y + '" r="2.2" fill="#cbd5e1"/>');
    });
    App.store.state.checkins.forEach(function (c) {
      var lon = c.lon, lat = c.lat;
      var cd = App.cityMap[c.cityName];
      if ((lon == null || lat == null) && cd) { lon = cd.lon; lat = cd.lat; }
      if (lon == null || lat == null) return;
      var pt = M.project(lon, lat);
      dots.push('<circle cx="' + pt.x + '" cy="' + pt.y + '" r="5" fill="#0d9488" stroke="#fff" stroke-width="1.5"/>');
      dots.push('<text x="' + (pt.x + 7) + '" y="' + (pt.y + 3) + '" font-size="10" fill="#0f766e">' + App.utils.esc(c.cityName) + '</text>');
    });

    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full h-auto">' + paths + dots.join('') + '</svg>';
  }

  function firstPhoto(checkinId) {
    var list = App.store.state.photos;
    for (var i = 0; i < list.length; i++) {
      if (list[i].checkinId === checkinId) return list[i].dataUrl;
    }
    return null;
  }

  return { init: init, onShow: onShow };
})();