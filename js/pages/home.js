/**
 * 首页：欢迎语、在一起天数、随机情话、最近的纪念日 / 日记 / 照片 / 留言
 * 数据变化时通过 store 事件自动重新渲染，保证两人看到一致内容。
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
    // 点一下换一句情话
    document.getElementById('btn-love-word').addEventListener('click', function () {
      var i;
      do { i = Math.floor(Math.random() * LOVE_WORDS.length); } while (i === curWord && LOVE_WORDS.length > 1);
      curWord = i;
      document.getElementById('home-love-word').textContent = '“' + LOVE_WORDS[i] + '”';
    });

    // 最近照片点击开灯箱（事件委托）
    document.getElementById('home-recent-photos').addEventListener('click', function (e) {
      var el = e.target.closest('[data-photo-id]');
      if (el) App.pages.photos.openLightbox(el.dataset.photoId);
    });

    // 房间信息或任何数据变化时刷新
    App.store.on('room', render);
    App.store.on('all', render);
  }

  function onShow() { render(); }

  function render() {
    var s = App.store.state;
    if (!s.roomKey || !s.profile) return;

    // —— 欢迎语（对方加入后会变化）——
    var other = s.members.find(function (m) { return m.id !== s.profile.id; });
    var myName = s.profile.name || '我';
    document.getElementById('home-greeting').textContent = other
      ? ('今天也要一起加油呀，' + other.name + ' 和 ' + myName)
      : '等待 TA 加入房间…';
    document.getElementById('home-hello').textContent = other
      ? ('Hi，' + other.name + ' 💕')
      : ('Hi，' + myName + ' 💕');

    // —— 在一起天数 ——
    if (s.room && s.room.startDate) {
      var start = App.utils.parseDate(s.room.startDate);
      var days = App.utils.daysDiff(new Date(), start);
      document.getElementById('home-days').textContent = days >= 0 ? days : 0;
      document.getElementById('home-since').textContent = '从 ' + s.room.startDate + ' 开始，一路有你';
    } else {
      document.getElementById('home-days').textContent = '--';
      document.getElementById('home-since').textContent = '还没有设置在一起的日子（右上角 ⚙️）';
    }

    // —— 情话（首次进入自动来一句）——
    if (curWord === -1) {
      curWord = Math.floor(Math.random() * LOVE_WORDS.length);
      document.getElementById('home-love-word').textContent = '“' + LOVE_WORDS[curWord] + '”';
    }

    renderNextAnniversary();
    renderRecentDiary();
    renderRecentPhotos();
    renderRecentMessages();
  }

  /** 最近的纪念日 */
  function renderNextAnniversary() {
    var box = document.getElementById('home-next-anniversary');
    var list = App.store.state.anniversaries;
    if (!list.length) {
      box.innerHTML = '<p class="text-rose-400 text-sm">还没有纪念日，去添加一个吧～</p>';
      return;
    }
    var best = null, bestDays = Infinity;
    list.forEach(function (a) {
      if (!a.date) return;
      var next = App.utils.nextOccurrence(a.date);
      var days = Math.round((next - new Date()) / 86400000);
      if (days < bestDays) { bestDays = days; best = { a: a, days: days }; }
    });
    if (!best) {
      box.innerHTML = '<p class="text-rose-400 text-sm">暂无纪念日数据</p>';
      return;
    }
    var d = best.days;
    var tip = d === 0 ? '就是今天！🎉' : (d === 1 ? '就在明天！💗' : '还有 ' + d + ' 天');
    box.innerHTML = '<div class="flex items-center justify-between gap-2 text-sm">' +
      '<span class="truncate">🎀 ' + App.utils.esc(best.a.title) + '（' + App.utils.esc(best.a.date) + '）</span>' +
      '<span class="text-rose-500 font-bold whitespace-nowrap">' + tip + '</span></div>';
  }

  /** 最近 3 条日记 */
  function renderRecentDiary() {
    var box = document.getElementById('home-recent-diary');
    var list = App.store.state.diary.slice(0, 3);
    if (!list.length) {
      box.innerHTML = '<p class="text-rose-400 text-sm">还没有日记，去写下第一篇吧 ✍️</p>';
      return;
    }
    box.innerHTML = list.map(function (item) {
      var preview = App.utils.nl2br(item.text.slice(0, 60)) + (item.text.length > 60 ? '…' : '');
      return '<div class="flex items-start gap-2">' +
        '<span class="avatar shrink-0" style="background:' + App.utils.esc(item.authorColor || '#f9a8d4') + '">' + App.utils.esc((item.authorName || '?').charAt(0)) + '</span>' +
        '<div class="min-w-0">' +
          '<p class="text-rose-900 leading-snug">' + preview + '</p>' +
          '<p class="text-xs text-rose-300 mt-1">' + App.utils.esc(item.authorName || '') + ' · ' + App.utils.timeAgo(item.createdAt) + '</p>' +
        '</div></div>';
    }).join('');
  }

  /** 最近 4 张照片 */
  function renderRecentPhotos() {
    var box = document.getElementById('home-recent-photos');
    var list = App.store.state.photos.slice(0, 4);
    if (!list.length) {
      box.innerHTML = '<p class="text-rose-400 text-sm col-span-2">还没有照片，上传第一张吧 📷</p>';
      return;
    }
    box.innerHTML = list.map(function (p) {
      return '<button type="button" data-photo-id="' + App.utils.esc(p.id) + '" class="aspect-square rounded-2xl overflow-hidden bg-rose-50 focus:outline-none">' +
        '<img src="' + p.dataUrl + '" alt="' + App.utils.esc(p.caption || '照片') + '" class="w-full h-full object-cover hover:scale-105 transition duration-300">' +
      '</button>';
    }).join('');
  }

  /** 最新 3 条留言 */
  function renderRecentMessages() {
    var box = document.getElementById('home-recent-messages');
    var list = App.store.state.messages.slice(0, 3);
    if (!list.length) {
      box.innerHTML = '<p class="text-rose-400 text-sm">留言板空空的，给 TA 留个言吧 💌</p>';
      return;
    }
    box.innerHTML = list.map(function (m) {
      var name = m.anon ? '某人 💌' : (m.authorName || '某人');
      return '<div class="flex items-start gap-2">' +
        '<span class="avatar shrink-0" style="background:' + App.utils.esc(m.anon ? '#f9a8d4' : (m.authorColor || '#f9a8d4')) + '">' + App.utils.esc(name.charAt(0)) + '</span>' +
        '<div class="min-w-0">' +
          '<p class="text-rose-900 leading-snug">' + App.utils.esc(m.text) + '</p>' +
          '<p class="text-xs text-rose-300 mt-1">' + App.utils.esc(name) + ' · ' + App.utils.timeAgo(m.createdAt) + '</p>' +
        '</div></div>';
    }).join('');
  }

  return { init: init, onShow: onShow };
})();