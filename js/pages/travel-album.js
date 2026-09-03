/**
 * 旅行相册：
 * - 顶部统计：照片总数 / 覆盖城市数
 * - 城市筛选 chips：全部 / 各城市
 * - 全部时按城市分组展示，选中城市时平铺展示
 */
App.pages = App.pages || {};
App.pages.album = (function () {

  var filterCity = 'all';

  function init() {
    document.getElementById('album-filter').addEventListener('click', function (e) {
      var el = e.target.closest('[data-city]');
      if (!el) return;
      filterCity = el.dataset.city;
      render();
    });

    document.getElementById('album-grid').addEventListener('click', function (e) {
      var el = e.target.closest('[data-photo-url]');
      if (el) App.showLightbox(el.dataset.photoUrl);
    });

    App.store.on('photos', render);
    App.store.on('checkins', render);
  }

  function onShow() { render(); }

  function cityNameOf(checkinId) {
    var c = App.store.state.checkins.find(function (x) { return x.id === checkinId; });
    return c ? c.cityName : null;
  }

  function render() {
    var photos = App.store.state.photos;

    // 城市集合（有照片的城市）
    var citySet = {};
    photos.forEach(function (p) {
      var city = cityNameOf(p.checkinId) || '未分类';
      citySet[city] = (citySet[city] || 0) + 1;
    });
    var cities = Object.keys(citySet);

    document.getElementById('album-stats').textContent = photos.length + ' 张照片 · ' + cities.length + ' 座城市';

    // 筛选 chips
    var filterBox = document.getElementById('album-filter');
    var chips = ['<button type="button" data-city="all" class="' + chipClass(filterCity === 'all') + '">全部 ' + photos.length + '</button>'];
    cities.forEach(function (city) {
      chips.push('<button type="button" data-city="' + App.utils.esc(city) + '" class="' + chipClass(filterCity === city) + '">' + App.utils.esc(city) + ' ' + citySet[city] + '</button>');
    });
    filterBox.innerHTML = chips.join('');

    // 照片网格
    var box = document.getElementById('album-grid');
    if (!photos.length) {
      box.innerHTML = '<div class="text-center py-12 text-slate-400">还没有旅行照片，去新增打卡并上传照片吧 📷</div>';
      return;
    }

    if (filterCity === 'all') {
      var groups = [];
      var map = {};
      photos.forEach(function (p) {
        var key = cityNameOf(p.checkinId) || '未分类';
        if (!map[key]) { map[key] = []; groups.push(key); }
        map[key].push(p);
      });
      box.innerHTML = groups.map(function (city) {
        var list = map[city];
        return '<div class="mb-5">' +
          '<div class="flex items-center gap-2 mb-2">' +
            '<span class="text-lg">📍</span><h3 class="font-semibold text-teal-700">' + App.utils.esc(city) + '</h3>' +
            '<span class="text-xs text-slate-400">' + list.length + ' 张</span>' +
          '</div>' +
          '<div class="grid grid-cols-3 gap-2">' + photoCells(list) + '</div></div>';
      }).join('');
    } else {
      var list = photos.filter(function (p) { return (cityNameOf(p.checkinId) || '未分类') === filterCity; });
      box.innerHTML = '<div class="grid grid-cols-3 gap-2">' + photoCells(list) + '</div>';
    }
  }

  function photoCells(list) {
    return list.map(function (p) {
      return '<button type="button" data-photo-url="' + App.utils.esc(p.dataUrl) + '" class="aspect-square rounded-2xl overflow-hidden bg-slate-100 focus:outline-none">' +
        '<img src="' + App.utils.esc(p.dataUrl) + '" class="w-full h-full object-cover hover:scale-105 transition duration-300" alt="">' +
      '</button>';
    }).join('');
  }

  function chipClass(active) {
    return active
      ? 'px-3 py-1.5 rounded-full text-xs bg-teal-500 text-white whitespace-nowrap'
      : 'px-3 py-1.5 rounded-full text-xs bg-white text-teal-700 border border-teal-100 whitespace-nowrap';
  }

  return { init: init, onShow: onShow };
})();