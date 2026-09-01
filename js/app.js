/**
 * 应用启动入口：初始化所有模块、恢复本地会话、渲染头部
 */
window.App = window.App || {};

/** 从配对页切换到主应用 */
App.showApp = function () {
  document.getElementById('pairing-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('bottom-nav').classList.remove('hidden');
};

/** 启动 */
App.boot = function () {
  // 漂浮爱心背景
  App.utils.spawnHearts(14);

  // 初始化各模块（页面 + 路由 + 配对）
  App.router.init();
  App.pages.home.init();
  App.pages.countdown.init();
  App.pages.diary.init();
  App.pages.photos.init();
  App.pages.anniversary.init();
  App.pages.message.init();
  App.pairing.init();
  bindHeader();

  // 恢复本地会话：之前创建/加入过房间就直接进入
  var roomId = localStorage.getItem(App.config.LS_ROOM_ID);
  var roomKey = localStorage.getItem(App.config.LS_ROOM_KEY);
  var profileRaw = localStorage.getItem(App.config.LS_PROFILE);
  if (roomId && roomKey && profileRaw) {
    var profile = null;
    try { profile = JSON.parse(profileRaw); } catch (e) {}
    if (profile && profile.id && profile.name) {
      // Supabase 初始化是同步创建 client 的，但仍保留 Promise 统一处理
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

/** 头部按钮：复制密钥、设置弹窗、退出房间 */
function bindHeader() {
  document.getElementById('btn-copy-key').addEventListener('click', function () {
    var key = App.store.state.roomKey;
    if (!key) return;
    App.utils.copyText(key).then(function (ok) {
      App.utils.toast(ok ? '房间密钥已复制 📋' : '复制失败，请手动复制');
    });
  });

  // —— 设置弹窗 ——
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', function () {
    document.getElementById('settings-modal').classList.add('hidden');
  });
  document.getElementById('settings-modal').addEventListener('click', function (e) {
    if (e.target.id === 'settings-modal') {
      document.getElementById('settings-modal').classList.add('hidden');
    }
  });

  // 修改昵称（同步到云端，TA 那边会实时更新）
  document.getElementById('settings-save-name').addEventListener('click', function () {
    var name = document.getElementById('settings-name').value.trim();
    if (!name) { App.utils.toast('昵称不能为空'); return; }
    App.store.updateProfile({ name: name });
    App.utils.toast('昵称已更新 💕');
  });

  // 修改"在一起的日子"（同步到房间文档，TA 那边实时更新）
  document.getElementById('settings-save-date').addEventListener('click', function () {
    var date = document.getElementById('settings-startdate').value;
    if (!date) { App.utils.toast('请选择日期'); return; }
    App.store.updateRoom({ startDate: date }).then(function () {
      App.utils.toast('在一起的日子已更新 💕');
    }).catch(function (err) {
      console.error(err);
      App.utils.toast('保存失败');
    });
  });

  // 复制房间密钥
  document.getElementById('settings-copy-key').addEventListener('click', function () {
    App.utils.copyText(App.store.state.roomKey || '').then(function (ok) {
      App.utils.toast(ok ? '密钥已复制 📋' : '复制失败');
    });
  });

  // 退出房间
  document.getElementById('btn-leave-room').addEventListener('click', function () {
    document.getElementById('settings-modal').classList.add('hidden');
    App.pairing.leaveRoom();
  });

  // 头部成员头像 + 房间密钥显示
  App.store.on('members', renderHeader);
  App.store.on('room', renderHeader);
}

/** 打开设置弹窗并回填当前值 */
function openSettings() {
  var s = App.store.state;
  document.getElementById('settings-name').value = s.profile ? s.profile.name : '';
  document.getElementById('settings-startdate').value = (s.room && s.room.startDate) || App.utils.fmtDate(new Date());
  document.getElementById('settings-key').textContent = s.roomKey || '';
  document.getElementById('settings-modal').classList.remove('hidden');
}

/** 头部：显示房间密钥和成员头像 */
function renderHeader() {
  var s = App.store.state;
  if (!s.roomKey) return;
  document.getElementById('header-roomkey').textContent = s.roomKey || '';
  var wrap = document.getElementById('header-members');
  wrap.innerHTML = s.members.map(function (m) {
    return '<span class="avatar" title="' + App.utils.esc(m.name) + '" style="background:' + App.utils.esc(m.color || '#f9a8d4') + '">' +
      App.utils.esc((m.name || '?').charAt(0)) + '</span>';
  }).join('') || '<span class="text-xs text-rose-300">等待成员…</span>';
}

// 页面加载完成后启动
document.addEventListener('DOMContentLoaded', App.boot);