/**
 * 新增 / 编辑 旅行打卡
 * 支持城市自动补全省份/经纬度，支持一次上传多张照片。
 * 保存后照片绑定该打卡记录（checkin_id）。
 */
App.pages = App.pages || {};
App.pages.checkin = (function () {

  var editingId = null;   // 正在编辑的打卡 id（null = 新增）
  var matchedLon = null;
  var matchedLat = null;
  var pending = [];       // 已压缩待上传的图片 Blob

  function init() {
    document.getElementById('checkin-form').addEventListener('submit', onSubmit);

    // 城市输入 → 自动补全省份/经纬度
    document.getElementById('checkin-city').addEventListener('input', function () {
      var name = this.value.trim();
      var c = App.cityMap[name];
      if (c) {
        document.getElementById('checkin-province').value = c.province;
        document.getElementById('checkin-country').value = '中国';
        matchedLon = c.lon;
        matchedLat = c.lat;
      } else {
        matchedLon = null;
        matchedLat = null;
      }
    });

    // 选图 → 压缩 + 预览（暂存待上传）
    document.getElementById('checkin-files').addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files || []);
      var jobs = files.map(compressImage);
      Promise.all(jobs).then(function (blobs) {
        blobs.forEach(function (blob) { pending.push(blob); });
        renderPreviews();
      }).catch(function (err) { console.error(err); App.utils.toast('图片处理失败'); });
      this.value = '';
    });
  }

  /** 打开新增表单 */
  function openNew() {
    App.router.show('checkin');
  }

  /** 从城市目录进入新增，并预填城市名 */
  function openNewForCity(cityName) {
    App.router.show('checkin'); // onShow 会先重置
    document.getElementById('checkin-city').value = cityName;
    var c = App.cityMap[cityName];
    if (c) {
      document.getElementById('checkin-province').value = c.province;
      document.getElementById('checkin-country').value = '中国';
      matchedLon = c.lon;
      matchedLat = c.lat;
    }
  }

  /** 打开编辑表单，回填数据 */
  function openEdit(id) {
    App.router.show('checkin'); // onShow 会先重置为新增
    var c = App.store.state.checkins.find(function (x) { return x.id === id; });
    if (!c) return;
    editingId = id;
    document.getElementById('checkin-title').textContent = '编辑打卡';
    document.getElementById('checkin-city').value = c.cityName || '';
    document.getElementById('checkin-province').value = c.province || '';
    document.getElementById('checkin-country').value = c.country || '中国';
    document.getElementById('checkin-date').value = c.visitDate || '';
    document.getElementById('checkin-companion').value = c.companion || '';
    document.getElementById('checkin-note').value = c.note || '';
    matchedLon = c.lon || null;
    matchedLat = c.lat || null;
  }

  /** 每次进入页面：重置为新增模式 */
  function onShow() {
    editingId = null;
    pending = [];
    matchedLon = null;
    matchedLat = null;
    document.getElementById('checkin-title').textContent = '新增打卡';
    document.getElementById('checkin-form').reset();
    document.getElementById('checkin-country').value = '中国';
    document.getElementById('checkin-previews').innerHTML = '';
  }

  function onSubmit(e) {
    e.preventDefault();
    var city = document.getElementById('checkin-city').value.trim();
    if (!city) { App.utils.toast('先填写城市名称哦 🏙️'); return; }

    var data = {
      cityName: city,
      province: document.getElementById('checkin-province').value.trim(),
      country: document.getElementById('checkin-country').value.trim() || '中国',
      visitDate: document.getElementById('checkin-date').value,
      companion: document.getElementById('checkin-companion').value.trim(),
      note: document.getElementById('checkin-note').value.trim(),
      lon: matchedLon,
      lat: matchedLat
    };

    var btn = document.getElementById('checkin-submit');
    var old = btn.textContent;
    btn.disabled = true; btn.textContent = '保存中…';

    var done = editingId
      ? App.store.update('checkins', editingId, data).then(function (res) { if (res.error) throw res.error; return editingId; })
      : App.store.write('checkins', data).then(function (res) { if (res.error) throw res.error; return res.data.id; });

    done.then(function (checkinId) {
      // 依次上传选中的照片，并绑定 checkin_id
      var chain = Promise.resolve();
      pending.forEach(function (blob) {
        chain = chain.then(function () { return App.store.uploadPhoto(blob, '', checkinId); });
      });
      return chain.then(function () { return checkinId; });
    }).then(function (checkinId) {
      App.utils.toast('打卡已保存 🎉');
      App.pages['checkin-detail'].open(checkinId);
    }).catch(function (err) {
      console.error(err);
      App.utils.toast('保存失败，请重试');
    }).finally(function () {
      btn.disabled = false; btn.textContent = old;
    });
  }

  /** 渲染待上传图片预览 */
  function renderPreviews() {
    var box = document.getElementById('checkin-previews');
    if (!pending.length) { box.innerHTML = ''; return; }
    box.innerHTML = pending.map(function (blob, i) {
      var url = URL.createObjectURL(blob);
      return '<div class="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100">' +
        '<img src="' + url + '" class="w-full h-full object-cover" alt="">' +
        '<button type="button" data-remove="' + i + '" class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white text-xs">✕</button>' +
      '</div>';
    }).join('');
    // 移除某张待上传图片
    box.querySelectorAll('[data-remove]').forEach(function (b) {
      b.addEventListener('click', function () {
        pending.splice(Number(b.dataset.remove), 1);
        renderPreviews();
      });
    });
  }

  /** 图片压缩：最长边 900px、JPEG 质量 0.75，返回 Blob */
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

  return { init: init, onShow: onShow, openNew: openNew, openNewForCity: openNewForCity, openEdit: openEdit };
})();