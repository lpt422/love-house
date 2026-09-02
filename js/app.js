/**
 * 应用启动入口：初始化所有模块、恢复本地会话、渲染头部
 */
window.App = window.App || {};

App.showApp = function () {
  document.getElementById('pairing-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('bottom-nav').classList.remove('hidden');
};

/** 全局照片灯箱 */
App.showLightbox = function (url) {
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox').classList.remove('hidden');
};
App.hideLightbox = function () {
  document.getElementById('lightbox').classList.add('hidden');
};

App.boot = function () {
  App.utils.spawnHearts(14);

  App.router.init();

  // 主模块
  App.pages.home.init();
  App.pages.checkin.init();
  App.pages['checkin-detail'].init();
  App.pages.album.init();

  // 纪念日（首页置顶）+ 日记·留言


  App.pages.anniversary.init();
  App.pages.notes.init();

  App.pairing.init();
  bindHeader();
  bindLightbox();

  // 恢复本地会话
  var roomId = localStorage.getItem(App.config.LS_ROOM_ID);
  var roomKey = localStorage.getItem(App.config.LS_ROOM_KEY);
  var profileRaw = localStorage.getItem(App.config.LS_PROFILE);
  if (roomId && roomKey && profileRaw) {
    var profile = null;
    try { profile = JSON.parse(profileRaw); } catch (e) {}
    if (profile && profile.id && profile.name) {
      App.supabase.init().then(function (ok) {
        if (ok) {
          App.store.init(roomId, roomKey, profile);
          App.showApp();
          App.router.show('home');
          return;
        }
        App.utils.toast('请先在 js/config.js 配置 Supabase');
        App.pairing.showPairing();
      }).catch(function (err) {
        console.error(err);
        App.utils.toast('初始化失败：' + ((err && err.message) || '请检查配置和网络'));
        App.pairing.showPairing();
      });
      return;
    }
  }
  App.pairing.showPairing();
};

function bindLightbox() {
  document.getElementById('lightbox-close').addEventListener('click', App.hideLightbox);
  document.getElementById('lightbox').addEventListener('click', function (e) {
    if (e.target.id === 'lightbox') App.hideLightbox();
  });
}

function bindHeader() {
  document.getElementById('btn-copy-key').addEventListener('click', function () {
    var key = App.store.state.roomKey;
    if (!key) return;
    App.utils.copyText(key).then(function (ok) {
      App.utils.toast(ok ? '房间密钥已复制 📋' : '复制失败，请手动复制');
    });
  });

  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', function () {
    document.getElementById('settings-modal').classList.add('hidden');
  });
  document.getElementById('settings-modal').addEventListener('click', function (e) {
    if (e.target.id === 'settings-modal') document.getElementById('settings-modal').classList.add('hidden');
  });

  document.getElementById('settings-save-name').addEventListener('click', function () {
    var name = document.getElementById('settings-name').value.trim();
    if (!name) { App.utils.toast('昵称不能为空'); return; }
    App.store.updateProfile({ name: name });
    App.utils.toast('昵称已更新 💕');
  });

  document.getElementById('settings-save-date').addEventListener('click', function () {
    var date = document.getElementById('settings-startdate').value;
    if (!date) { App.utils.toast('请选择日期'); return; }
    App.store.updateRoom({ startDate: date }).then(function () {
      App.utils.toast('已更新 💕');
    }).catch(function (err) { console.error(err); App.utils.toast('保存失败'); });
  });

  document.getElementById('settings-copy-key').addEventListener('click', function () {
    App.utils.copyText(App.store.state.roomKey || '').then(function (ok) {
      App.utils.toast(ok ? '密钥已复制 📋' : '复制失败');
    });
  });

  document.getElementById('btn-leave-room').addEventListener('click', function () {
    document.getElementById('settings-modal').classList.add('hidden');
    App.pairing.leaveRoom();
  });

  App.store.on('members', renderHeader);
  App.store.on('room', renderHeader);
}

function openSettings() {
  var s = App.store.state;
  document.getElementById('settings-name').value = s.profile ? s.profile.name : '';
  document.getElementById('settings-startdate').value = (s.room && s.room.startDate) || App.utils.fmtDate(new Date());
  document.getElementById('settings-key').textContent = s.roomKey || '';
  document.getElementById('settings-modal').classList.remove('hidden');
}

function renderHeader() {
  var s = App.store.state;
  if (!s.roomKey) return;
  document.getElementById('header-roomkey').textContent = s.roomKey || '';
  var wrap = document.getElementById('header-members');
  wrap.innerHTML = s.members.map(function (m) {
    return '<span class="avatar" title="' + App.utils.esc(m.name) + '" style="background:' + App.utils.esc(m.color || '#5eead4') + '">' +
      App.utils.esc((m.name || '?').charAt(0)) + '</span>';
  }).join('') || '<span class="text-xs text-teal-300">等待成员…</span>';
}

document.addEventListener('DOMContentLoaded', App.boot);