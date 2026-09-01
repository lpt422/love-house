/**
 * 配对逻辑：创建房间 / 加入房间 / 退出房间
 * 房间密钥（6 位数字）保存在浏览器 localStorage，刷新页面、换设备重新打开都不会掉线。
 * 用户身份：不使用账号密码，用 localStorage 里的 userId 模拟匿名身份。
 */
window.App = window.App || {};

App.pairing = (function () {

  // 成员头像的柔和配色
  var COLORS = ['#f472b6', '#fb7185', '#a78bfa', '#818cf8', '#fbbf24', '#34d399', '#38bdf8', '#f97316'];

  function init() {
    // 创建 / 加入 模式切换
    document.getElementById('pair-tab-create').addEventListener('click', function () { switchMode('create'); });
    document.getElementById('pair-tab-join').addEventListener('click', function () { switchMode('join'); });

    document.getElementById('create-form').addEventListener('submit', onCreate);
    document.getElementById('join-form').addEventListener('submit', onJoin);

    // 创建成功后的"分享密钥"弹窗
    document.getElementById('share-copy').addEventListener('click', copyShareKey);
    document.getElementById('share-done').addEventListener('click', function () {
      document.getElementById('share-modal').classList.add('hidden');
    });
  }

  function switchMode(mode) {
    document.getElementById('create-form').classList.toggle('hidden', mode !== 'create');
    document.getElementById('join-form').classList.toggle('hidden', mode !== 'join');
    document.querySelectorAll('.pair-tab').forEach(function (b) {
      b.classList.toggle('active-tab', b.id === 'pair-tab-' + mode);
    });
  }

  /** 创建房间：生成 6 位密钥 + 写入房间 + 进入 */
  function onCreate(e) {
    e.preventDefault();
    var name = document.getElementById('create-name').value.trim();
    if (!name) { App.utils.toast('先给自己起个昵称吧～'); return; }
    var startDate = document.getElementById('create-date').value || App.utils.fmtDate(new Date());

    ensureReady(function () {
      var profile = makeProfile(name);
      tryCreateRoom(profile, startDate, 0);
    });
  }

  /** 创建房间（带密钥冲突重试，6 位数字理论上极小概率撞车） */
  function tryCreateRoom(profile, startDate, attempt) {
    if (attempt >= 5) { App.utils.toast('创建失败，请重试'); return; }
    var key = App.utils.genRoomKey();

    App.store.createRoom(key, profile, startDate).then(function (room) {
      // 保存到本机，刷新不掉线（同时保存内部 id 和 6 位密钥）
      localStorage.setItem(App.config.LS_ROOM_ID, room.id);
      localStorage.setItem(App.config.LS_ROOM_KEY, key);
      localStorage.setItem(App.config.LS_PROFILE, JSON.stringify(profile));
      // 进入房间并挂载实时监听
      App.store.init(room.id, key, profile);
      App.router.show('home');
      App.showApp();
      // 弹出"把密钥发给 TA"
      document.getElementById('share-key').textContent = key;
      document.getElementById('share-modal').classList.remove('hidden');
    }).catch(function (err) {
      console.error(err);
      // 23505 = 唯一键冲突（房间密钥重复），换一个密钥重试
      if (err && (err.code === '23505' || String(err.message).indexOf('duplicate') >= 0)) {
        tryCreateRoom(profile, startDate, attempt + 1);
      } else {
        App.utils.toast('创建失败，请检查 Supabase 配置');
      }
    });
  }

  /** 加入房间：校验 6 位密钥对应房间存在，然后进入 */
  function onJoin(e) {
    e.preventDefault();
    var name = document.getElementById('join-name').value.trim();
    var key = App.utils.normalizeKey(document.getElementById('join-key').value);
    if (!name) { App.utils.toast('先给自己起个昵称吧～'); return; }
    if (key.length !== 6) { App.utils.toast('房间密钥是 6 位数字哦'); return; }

    ensureReady(function () {
      var profile = makeProfile(name);
      App.store.joinRoom(key, profile).then(function (room) {
        localStorage.setItem(App.config.LS_ROOM_ID, room.id);
        localStorage.setItem(App.config.LS_ROOM_KEY, key);
        localStorage.setItem(App.config.LS_PROFILE, JSON.stringify(profile));
        App.store.init(room.id, key, profile);
        App.router.show('home');
        App.showApp();
      }).catch(function (err) {
        console.error(err);
        App.utils.toast(err && err.code === 'ROOM_NOT_FOUND'
          ? '没有找到这个房间，检查一下密钥？'
          : '加入失败，请检查网络和 Supabase 配置');
      });
    });
  }

  /** 确保 Supabase 客户端已初始化后再执行 fn */
  function ensureReady(fn) {
    App.supabase.init().then(function (ok) {
      if (!ok) { showConfigWarning(); return; }
      fn();
    }).catch(function (err) {
      console.error(err);
      App.utils.toast('初始化失败：' + ((err && err.message) || '请检查配置和网络'));
    });
  }

  /** 生成我的设备档案（userId 从 localStorage 复用，稳定不重复） */
  function makeProfile(name) {
    return {
      id: App.utils.getUserId(),
      name: name,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    };
  }

  /** 退出房间：只清理本机记录，不删除云端数据 */
  function leaveRoom() {
    if (!confirm('确定退出当前房间吗？\n云端记录不会删除，之后用同一个密钥还能再进来。')) return;
    App.store.cleanup();
    localStorage.removeItem(App.config.LS_ROOM_ID);
    localStorage.removeItem(App.config.LS_ROOM_KEY);
    localStorage.removeItem(App.config.LS_PROFILE);
    showPairing();
  }

  /** 显示配对页 */
  function showPairing() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('bottom-nav').classList.add('hidden');
    document.getElementById('pairing-screen').classList.remove('hidden');
    // 未配置 Supabase 时给出醒目提示
    if (App.supabase.isConfigured()) {
      document.getElementById('config-warning').classList.add('hidden');
    } else {
      document.getElementById('config-warning').classList.remove('hidden');
    }
  }

  function showConfigWarning() {
    document.getElementById('config-warning').classList.remove('hidden');
    document.getElementById('config-warning').scrollIntoView({ behavior: 'smooth', block: 'center' });
    App.utils.toast('请先在 js/config.js 配置 Supabase');
  }

  function copyShareKey() {
    var key = document.getElementById('share-key').textContent;
    App.utils.copyText(key).then(function (ok) {
      App.utils.toast(ok ? '密钥已复制 📋' : '复制失败，请手动复制');
    });
  }

  return { init: init, leaveRoom: leaveRoom, showPairing: showPairing };
})();