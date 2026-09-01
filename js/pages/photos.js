/**
 * 相册页：选图 → 自动压缩 → 上传 Supabase Storage → 对方实时看到
 * 照片文件存 Storage（不塞 base64），数据库只存图片 URL。
 */
App.pages = App.pages || {};
App.pages.photos = (function () {

  function init() {
    // 选择文件后本地预览
    var fileInput = document.getElementById('photo-file');
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      var preview = document.getElementById('photo-preview');
      var img = document.getElementById('photo-preview-img');
      if (!f) { preview.classList.add('hidden'); return; }
      if (f.size > 10 * 1024 * 1024) {
        App.utils.toast('图片太大了，请选择 10MB 以内的');
        fileInput.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        img.src = e.target.result;
        preview.classList.remove('hidden');
      };
      reader.readAsDataURL(f);
    });

    // 上传
    document.getElementById('photo-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = fileInput.files && fileInput.files[0];
      if (!f) { App.utils.toast('先选一张照片哦 📷'); return; }
      var caption = document.getElementById('photo-caption').value.trim();
      var btn = document.getElementById('photo-submit');
      var old = btn.textContent;
      btn.disabled = true;
      btn.textContent = '上传中…';

      // 压缩成 jpeg Blob → 上传 Storage → 数据库写入图片 URL
      compressImage(f).then(function (blob) {
        return App.store.uploadPhoto(blob, caption);
      }).then(function () {
        fileInput.value = '';
        document.getElementById('photo-preview').classList.add('hidden');
        document.getElementById('photo-caption').value = '';
        App.utils.toast('照片上传成功 📸');
      }).catch(function (err) {
        console.error(err);
        App.utils.toast('上传失败，请检查 Storage 桶和权限');
      }).finally(function () {
        btn.disabled = false;
        btn.textContent = old;
      });
    });

    // 网格事件委托：点照片开灯箱
    document.getElementById('photo-grid').addEventListener('click', function (e) {
      var el = e.target.closest('[data-photo-id]');
      if (el) openLightbox(el.dataset.photoId);
    });

    // 灯箱关闭
    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    document.getElementById('lightbox').addEventListener('click', function (e) {
      if (e.target.id === 'lightbox') closeLightbox();
    });

    App.store.on('photos', render);
  }

  /**
   * 图片压缩：最长边 900px、JPEG 质量 0.75
   * 返回 Blob（image/jpeg），避免十几 MB 的大图直接上传。
   */
  function compressImage(file, maxW, quality) {
    maxW = maxW || 900;
    quality = quality || 0.75;
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(function (blob) {
            if (blob) resolve(blob);
            else reject(new Error('图片压缩失败'));
          }, 'image/jpeg', quality);
        };
        img.onerror = function () { reject(new Error('图片解析失败')); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.readAsDataURL(file);
    });
  }

  /** 打开灯箱（首页最近照片也会调用） */
  function openLightbox(id) {
    var photo = App.store.state.photos.find(function (p) { return p.id === id; });
    if (!photo) return;
    document.getElementById('lightbox-img').src = photo.dataUrl;
    document.getElementById('lightbox').classList.remove('hidden');
  }

  function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
  }

  function render() {
    var list = App.store.state.photos;
    var grid = document.getElementById('photo-grid');
    if (!list.length) {
      grid.innerHTML = '<div class="col-span-full text-center py-10 text-rose-300">相册还是空的，上传第一张照片吧 📷</div>';
      return;
    }
    grid.innerHTML = list.map(function (p) {
      return '<button type="button" data-photo-id="' + App.utils.esc(p.id) + '" class="group relative aspect-square rounded-2xl overflow-hidden bg-rose-100 focus:outline-none">' +
        '<img src="' + App.utils.esc(p.dataUrl) + '" alt="' + App.utils.esc(p.caption || '照片') + '" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">' +
        (p.caption ? '<span class="absolute inset-x-0 bottom-0 bg-black/40 text-white text-xs px-2 py-1 backdrop-blur-sm truncate">' + App.utils.esc(p.caption) + '</span>' : '') +
      '</button>';
    }).join('');
  }

  return { init: init, onShow: render, openLightbox: openLightbox, closeLightbox: closeLightbox };
})();