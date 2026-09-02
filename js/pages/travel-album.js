/**
 * 旅行相册：按城市分组展示全部上传照片。
 * 照片通过 checkin_id 绑定打卡记录；未绑定的旧照片归入「未分类」。
 */
App.pages = App.pages || {};
App.pages.album = (function () {

  function init() {
    document.getElementById('album-grid').addEventListener('click', function (e) {
      var el = e.target.closest('[data-photo-url]');
      if (el) App.showLightbox(el.dataset.photoUrl);
    });
    App.store.on('photos', render);
    App.store.on('checkins', render);
  }

  function onShow() { render(); }

  function render() {
    var box = document.getElementById('album-grid');
    var photos = App.store.state.photos;
    if (!photos.length) {
      box.innerHTML = '<div class="text-center py-12 text-slate-400">还没有旅行照片，去新增打卡并上传照片吧 📷</div>';
      return;
    }

    // 按 checkin_id 分组
    var groups = [];
    var map = {};
    photos.forEach(function (p) {
      var key = p.checkinId || '__none__';
      if (!map[key]) { map[key] = []; groups.push(key); }
      map[key].push(p);
    });

    var cityById = {};
    App.store.state.checkins.forEach(function (c) { cityById[c.id] = c.cityName; });

    box.innerHTML = groups.map(function (key) {
      var list = map[key];
      var city = key === '__none__' ? '未分类' : (cityById[key] || '未命名打卡');
      return '<div class="mb-5">' +
        '<div class="flex items-center gap-2 mb-2">' +
          '<span class="text-lg">📍</span><h3 class="font-semibold text-teal-700">' + App.utils.esc(city) + '</h3>' +
          '<span class="text-xs text-slate-400">' + list.length + ' 张</span>' +
        '</div>' +
        '<div class="grid grid-cols-3 gap-2">' +
          list.map(function (p) {
            return '<button type="button" data-photo-url="' + App.utils.esc(p.dataUrl) + '" class="aspect-square rounded-2xl overflow-hidden bg-slate-100 focus:outline-none">' +
              '<img src="' + App.utils.esc(p.dataUrl) + '" class="w-full h-full object-cover" alt="">' +
            '</button>';
          }).join('') +
        '</div></div>';
    }).join('');
  }

  return { init: init, onShow: onShow };
})();