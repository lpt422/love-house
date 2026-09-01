/**
 * Supabase 客户端初始化
 * 使用 Supabase JS SDK v2，CDN 方式引入（全局变量 supabase）。
 * 本应用「不登录账号」，只用 localStorage 里的 userId 模拟设备匿名身份，
 * 因此这里只负责创建 client，不需要 signIn。
 */
window.App = window.App || {};

App.supabase = (function () {
  var client = null;   // Supabase 客户端实例

  /** 判断是否已填入真实配置（占位配置未替换时返回 false） */
  function isConfigured() {
    var c = App.config.SUPABASE;
    return !!(c && c.projectUrl && c.anonKey &&
      String(c.projectUrl).trim() !== '' &&
      String(c.anonKey).trim() !== '' &&
      String(c.projectUrl).indexOf('YOUR_') !== 0 &&
      String(c.anonKey).indexOf('YOUR_') !== 0);
  }

  /**
   * 初始化客户端。返回 Promise<boolean>：
   *   true  = 已就绪
   *   false = 还没配置（页面会提示）
   * 可重复调用，第二次起直接复用。
   */
  function init() {
    if (client) return Promise.resolve(true);
    if (!isConfigured()) return Promise.resolve(false);
    if (typeof supabase === 'undefined') {
      return Promise.reject(new Error('Supabase SDK 未加载，请检查网络或 CDN'));
    }
    try {
      client = supabase.createClient(
        App.config.SUPABASE.projectUrl,
        App.config.SUPABASE.anonKey
      );
      return Promise.resolve(true);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  /** 返回当前客户端（未初始化时返回 null） */
  function getClient() { return client; }

  return { init: init, isConfigured: isConfigured, client: getClient };
})();