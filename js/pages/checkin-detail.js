/**
 * 打卡详情页：展示单条旅行记录，支持编辑/删除，并可随时增删照片。
 */
App.pages = App.pages || {};
App.pages['checkin-detail'] = (function () {

  var currentId = null;
  var editingPhotos = false;   // 是否处于「编辑照片」模式

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

    // 添加照片
    document.getElementById('detail-add-photo').addEventListener('click', function () {
      document.getElementById('detail-photo-file').click();
    });
    document.getElementById('detail-photo-file').addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files || []);
      this.value = '';
      if (!files.length || !currentId) return;
      var jobs = files.map(compressImage);
      Promise.all(jobs).then(function (blobs) {
        var chain = Promise.resolve();
        blobs.forEach(function (blob) {
          chain = chain.then(function () { return App.store.uploadPhoto(blob, '', currentId); });
        });
        return chain;
      }).then(function () {
        App.utils.toast('照片已添加 📷');
      }).catch(function (err) {
        console.error(err);
        App.utils.toast('照片上传失败');
      });
    });

    // 编辑照片模式开关
    document.getElementById('detail-edit-photos').addEventListener('click', function () {
      editingPhotos = !editingPhotos;
      this.textContent = editingPhotos ? '✅ 完成' : '✏️ 编辑';
      render();
    });

    // 照片点击：删除按钮删照片，其它区域看大图
    document.getElementById('detail-photos').addEventListener('click', function (e) {
      var del = e.target.closest('[data-photo-del]');
      if (del) {
        var pid = del.dataset.photoDel;
        if (confirm('删除这张照片吗？')) {
          App.store.removePhoto(pid).catch(function (err) { console.error(err); App.utils.toast('删除失败'); });
        }
        return;
      }
      var el = e.target.closest('[data-photo-url]');
      if (el) App.showLightbox(el.dataset.photoUrl);
    });

    App.store.on('checkins', render);
    App.store.on('photos', render);
  }

  function open(id) {
    currentId = id;
    editingPhotos = false;
    var btn = document.getElementById('detail-edit-photos');
    if (btn) btn.textContent = '✏️ 编辑';
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
      box.innerHTML = '<p class="text-slate-400 text-sm col-span-full">还没有照片，点「添加照片」上传</p>';
    } else {
      box.innerHTML = photos.map(function (p) {
        return '<div class="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 group">' +
          '<button type="button" data-photo-url="' + App.utils.esc(p.dataUrl) + '" class="w-full h-full focus:outline-none">' +
            '<img src="' + App.utils.esc(p.dataUrl) + '" class="w-full h-full object-cover" alt="">' +
          '</button>' +
          '<button type="button" data-photo-del="' + App.utils.esc(p.id) + '" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 text-white text-xs opacity-90">✕</button>' +
        '</div>';
      }).join('');
    }
  }

  function compressImage(file) {
    var maxW = 900, quality = 0.75;
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob(function (blob) {
            if (blob) resolve(blob); else reject(new Error('压缩失败'));
          }, 'image/jpeg', quality);
        };
        img.onerror = function () { reject(new Error('图片解析失败')); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject(new Error('读取失败')); };
      reader.readAsDataURL(file);
    });
  }

  return { init: init, onShow: onShow, open: open };
})();