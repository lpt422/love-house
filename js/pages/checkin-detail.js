/**
 * 打卡详情页：展示单条旅行记录（城市、时间、同行人、感悟、图片），支持编辑/删除。
 */
App.pages = App.pages || {};
App.pages['checkin-detail'] = (function () {

  var currentId = null;

  function init() {
    document.getElementById('detail-edit').addEventListener('click', function () {
      if (currentId) App.pages.checkin.openEdit(currentId);
    });
    document.getElementById('detail-delete').addEventListener('click', function () {
      if (!currentId) return;
      var c = find(currentId);
      if (!confirm('确定删除「' + (c && c.cityName || '这条打卡') + '」吗？\n相关照片记录也会一起删除。')) return;
      App.store.remove('checkins', currentId).then(function () {
        App.utils.toast('已删除');
        App.router.show('home');
      }).catch(function (err) { console.error(err); App.utils.toast('删除失败'); });
    });

    document.getElementById('detail-photos').addEventListener('click', function (e) {
      var el = e.target.closest('[data-photo-url]');
      if (el) App.showLightbox(el.dataset.photoUrl);
    });

    App.store.on('checkins', render);
    App.store.on('photos', render);
  }

  function open(id) {
    currentId = id;
    App.router.show('checkin-detail');
  }

  function onShow() { render(); }

  function find(id) {
    return App.store.state.checkins.find(function (c) { return c.id === id; });
  }

  function render() {
    var c = find(currentId);
    if (!c) {
      document.getElementById('detail-city').textContent = '未找到记录';
      document.getElementById('detail-place').textContent = '';
      document.getElementById('detail-date').textContent = '';
      document.getElementById('detail-companion').textContent = '';
      document.getElementById('detail-note').textContent = '';
      document.getElementById('detail-photos').innerHTML = '';
      return;
    }
    document.getElementById('detail-city').textContent = c.cityName || '';
    document.getElementById('detail-place').textContent = [c.province, c.country].filter(Boolean).join(' · ');
    document.getElementById('detail-date').textContent = c.visitDate || '未填日期';
    document.getElementById('detail-companion').textContent = c.companion || '未填写';
    document.getElementById('detail-note').textContent = c.note || '没有写游玩感悟';

    var photos = App.store.state.photos.filter(function (p) { return p.checkinId === c.id; });
    var box = document.getElementById('detail-photos');
    if (!photos.length) {
      box.innerHTML = '<p class="text-slate-400 text-sm col-span-full">还没有上传照片</p>';
    } else {
      box.innerHTML = photos.map(function (p) {
        return '<button type="button" data-photo-url="' + App.utils.esc(p.dataUrl) + '" class="aspect-square rounded-2xl overflow-hidden bg-slate-100 focus:outline-none">' +
          '<img src="' + App.utils.esc(p.dataUrl) + '" class="w-full h-full object-cover" alt="">' +
        '</button>';
      }).join('');
    }
  }

  return { init: init, onShow: onShow, open: open };
})();