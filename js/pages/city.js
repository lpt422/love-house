/**
 * 城市目录页：同一城市的多个打卡记录合并展示。
 * 一个城市只算一个「点亮城市」，这里列出该城市下的全部到访记录。
 */
App.pages = App.pages || {};
App.pages.city = (function () {

  var currentCity = null;

  function init() {
    document.getElementById('city-add').addEventListener('click', function () {
      if (currentCity) App.pages.checkin.openNewForCity(currentCity);
    });

    document.getElementById('city-list').addEventListener('click', function (e) {
      var el = e.target.closest('[data-checkin-id]');
      if (el) App.pages['checkin-detail'].open(el.dataset.checkinId);
    });

    App.store.on('checkins', render);
    App.store.on('photos', render);
  }

  function open(cityName) {
    currentCity = cityName;
    App.router.show('city');
  }

  function onShow() { render(); }

  function records() {
    return App.store.state.checkins.filter(function (c) { return c.cityName === currentCity; });
  }

  function render() {
    if (!currentCity) return;
    var list = records();
    var photos = list.reduce(function (n, c) {
      return n + App.store.state.photos.filter(function (p) { return p.checkinId === c.id; }).length;
    }, 0);

    var first = list[0];
    document.getElementById('city-name').textContent = currentCity;
    document.getElementById('city-place').textContent = first ? [first.province, first.country].filter(Boolean).join(' · ') : '';
    document.getElementById('city-count').textContent = list.length;
    document.getElementById('city-photo-count').textContent = photos;

    var box = document.getElementById('city-list');
    if (!list.length) {
      box.innerHTML = '<div class="text-center py-10 text-slate-400">这个城市还没有打卡记录</div>';
      return;
    }

    box.innerHTML = list.map(function (c) {
      var thumb = firstPhoto(c.id);
      return '<button type="button" data-checkin-id="' + App.utils.esc(c.id) + '" class="card p-3 text-left w-full">' +
        '<div class="flex gap-3">' +
          '<div class="w-16 h-16 rounded-xl overflow-hidden bg-sky-50 shrink-0 flex items-center justify-center">' +
            (thumb ? '<img src="' + App.utils.esc(thumb) + '" class="w-full h-full object-cover" alt="">' : '<span class="text-xl">🏙️</span>') +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<p class="text-xs text-slate-400">🕐 ' + App.utils.esc(c.visitDate || '未填日期') + '</p>' +
            '<p class="text-sm text-slate-600 mt-1 line-clamp-2">' + App.utils.esc(c.note || (c.companion ? '同行：' + c.companion : '没有写感悟')) + '</p>' +
          '</div>' +
        '</div></button>';
    }).join('');
  }

  function firstPhoto(checkinId) {
    var list = App.store.state.photos;
    for (var i = 0; i < list.length; i++) {
      if (list[i].checkinId === checkinId) return list[i].dataUrl;
    }
    return null;
  }

  return { init: init, onShow: onShow, open: open };
})();