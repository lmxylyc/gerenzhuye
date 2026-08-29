/* ==========================================================
   R.O.R 创作端口 v2.0 · 协作编辑脚本
   账号系统(注册/登录/审核) + GitHub Contents API 读写
   每个页面保存时生成独立子网址: w/<slug>.html
   ========================================================== */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var GL = window.GL || {};
  var DEFAULTS = {
    repo: (GL.config && GL.config.repo) || "lmxylyc/gerenzhuye",
    path: (GL.config && GL.config.contentPath) || "gerenzhuye/gl-universe/content"
  };
  var META_KEY = "gl_editor_meta_v1";
  var SESSION_KEY = "gl_auth_v1";
  var params = new URLSearchParams(window.location.search);
  if (params.get("repo")) DEFAULTS.repo = params.get("repo");
  if (params.get("path")) DEFAULTS.path = params.get("path");

  var cfg = { repo: DEFAULTS.repo, path: DEFAULTS.path, token: "" };
  var siteConfig = { site: { name: "GL 层群宇宙", allowRegister: true }, setupKey: "", token: "" };
  var users = [];
  var auth = null;          // 当前登录用户 {u, display, role, ...}
  var mode = "archives";
  var listItems = [];
  var editing = null;       // {name, path, sha}
  var editingOldSlug = null;
  var editingDate = null;
  var previewOn = false;
  var toastTimer = 0;

  var CATS = ["层级", "组织", "人物", "科技", "事件", "术语", "其他"];
  var CAT_PREFIX = { "层级": "GL-LVL", "组织": "GL-ORG", "人物": "GL-PSN", "科技": "GL-TECH", "事件": "GL-EVT", "术语": "GL-TRM", "其他": "GL-OTH" };
  var DIRS = { archives: "archives", docs: "docs" };
  var USERS_FILE = "users.json";
  var CONFIG_FILE = "site-config.json";
  var W_DIR = "w";

  /* ================= 基础工具 ================= */

  function esc(s) { return window.GLPage.esc(s); }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }
  function b64Encode(s) { return btoa(unescape(encodeURIComponent(s))); }
  function b64Decode(b) { return decodeURIComponent(escape(atob(b))); }
  function slugOf(meta) { return window.GLPage.slugOf(meta); }
  function pageURL(slug) { return window.GLPage.pageURL(slug); }

  function toast(msg, isErr) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.className = "toast show" + (isErr ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "toast"; }, 2400);
  }

  function canWrite() {
    return auth && (auth.role === "admin" || auth.role === "author");
  }

  function isAdmin() {
    return auth && auth.role === "admin";
  }

  /* ================= 存储 ================= */

  function loadMeta() {
    try {
      var raw = localStorage.getItem(META_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o.repo) cfg.repo = o.repo;
        if (o.path) cfg.path = o.path;
      }
    } catch (e) { /* 忽略 */ }
  }
  function saveMeta() {
    try { localStorage.setItem(META_KEY, JSON.stringify({ repo: cfg.repo, path: cfg.path })); } catch (e) { /* 忽略 */ }
  }

  /* ================= GitHub API ================= */

  function ghFetch(url) {
    return fetch(url, {
      headers: cfg.token ? { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json" } : { Accept: "application/vnd.github+json" },
      cache: "no-store"
    }).then(function (r) {
      if (r.status === 404) { var e = new Error("404 不存在"); e.status = 404; throw e; }
      if (r.status === 401) { var e2 = new Error("令牌无效"); e2.status = 401; throw e2; }
      if (r.status === 403) { var e3 = new Error("令牌权限不足或限流"); e3.status = 403; throw e3; }
      if (r.status === 409) { var e5 = new Error("文件已被他人修改，正在重试"); e5.status = 409; throw e5; }
      if (!r.ok) {
        return r.json().then(function (j) {
          var e4 = new Error((j && j.message) || ("HTTP " + r.status));
          e4.status = r.status;
          throw e4;
        });
      }
      return r.json();
    });
  }

  function retryOnce(fn) {
    return fn().catch(function (e) {
      if (e.status && e.status !== 500 && e.status !== 502 && e.status !== 503) throw e;
      return new Promise(function (res, rej) {
        setTimeout(function () { fn().then(res, rej); }, 900);
      });
    });
  }

  /* 公开读取（无需令牌） */
  function rawGet(path) {
    return fetch("https://raw.githubusercontent.com/" + cfg.repo + "/HEAD/" + encPath(path), { cache: "no-store" })
      .then(function (r) {
        if (r.status === 404) { var e = new Error("404"); e.status = 404; throw e; }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      });
  }

  function listDir(dir) {
    var url = "https://api.github.com/repos/" + cfg.repo + "/contents/" + encPath(dir);
    return retryOnce(function () { return ghFetch(url); });
  }

  function getFile(path) {
    var url = "https://api.github.com/repos/" + cfg.repo + "/contents/" + encPath(path);
    return retryOnce(function () { return ghFetch(url); });
  }

  function putFile(path, content, sha, message) {
    return ensureToken().then(function () {
      var url = "https://api.github.com/repos/" + cfg.repo + "/contents/" + encPath(path);
      var body = { message: message, content: b64Encode(content) };
      if (sha) body.sha = sha;
      return retryOnce(function () {
        return fetch(url, {
          method: "PUT",
          headers: { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json" },
          body: JSON.stringify(body)
        }).then(function (r) {
          if (!r.ok) {
            return r.json().then(function (j) {
              var e = new Error((j && j.message) || ("HTTP " + r.status));
              e.status = r.status;
              throw e;
            });
          }
          return r.json();
        });
      });
    });
  }

  function delFile(path, sha, message) {
    return ensureToken().then(function () {
      var url = "https://api.github.com/repos/" + cfg.repo + "/contents/" + encPath(path);
      return retryOnce(function () {
        return fetch(url, {
          method: "DELETE",
          headers: { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json" },
          body: JSON.stringify({ message: message, sha: sha })
        }).then(function (r) {
          if (!r.ok) {
            return r.json().then(function (j) {
              var e = new Error((j && j.message) || ("HTTP " + r.status));
              e.status = r.status;
              throw e;
            });
          }
          return r.json();
        });
      });
    });
  }

  /* ================= 账号系统 ================= */

  function hashPw(salt, pw) { return window.sha256Hex(salt + "::" + pw); }
  function makeSalt() {
    var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var s = "";
    for (var i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  function findUser(u) {
    for (var i = 0; i < users.length; i++) if (users[i].u === u) return users[i];
    return null;
  }

  /* 读 users.json（404 视为空） */
  function loadUsers() {
    return rawGet(cfg.path + "/" + USERS_FILE).then(function (text) {
      try {
        var o = JSON.parse(text);
        users = Array.isArray(o.users) ? o.users : [];
      } catch (e) { users = []; }
      return users;
    }).catch(function (e) {
      if (e.status === 404) { users = []; return users; }
      throw e;
    });
  }

/* 令牌加密存储: 以「写作口令」派生密钥流做异或加密, 密文为 盐:hex */
  function tokenKeyStream(key, salt, len) {
    var hex = "";
    var n = 0;
    while (hex.length < len * 2) { hex += window.sha256Hex(salt + "::" + key + "::" + n); n++; }
    var bytes = [];
    for (var i = 0; i < len; i++) bytes.push(parseInt(hex.substr(i * 2, 2), 16));
    return bytes;
  }
  function encryptToken(token, key) {
    if (!token || !key) return "";
    var salt = makeSalt();
    var ks = tokenKeyStream(key, salt, token.length);
    var out = "";
    for (var i = 0; i < token.length; i++) {
      out += ("0" + (token.charCodeAt(i) ^ ks[i]).toString(16)).slice(-2);
    }
    return salt + ":" + out;
  }
  function decryptToken(enc, key) {
    var p = String(enc || "").split(":");
    if (p.length !== 2 || !p[0] || !p[1]) return "";
    var salt = p[0], hex = p[1];
    var ks = tokenKeyStream(key, salt, hex.length / 2);
    var out = "";
    for (var i = 0; i < hex.length; i += 2) {
      out += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ ks[i / 2]);
    }
    return out;
  }
  var PASS_KEY = "gl_editor_pass";
  function getPass() { try { return localStorage.getItem(PASS_KEY); } catch (e) { return null; } }
  function setPass(p) { try { localStorage.setItem(PASS_KEY, p); } catch (e) { /* 忽略 */ } }

  /* 写操作前确保令牌可用; 令牌已加密时要求输入写作口令 */
  function ensureToken() {
    if (cfg.token) return Promise.resolve(cfg.token);
    if (!siteConfig.tokenEnc) return Promise.reject(new Error("站点未配置写入令牌"));
    var p = getPass();
    if (p) {
      try {
        cfg.token = decryptToken(siteConfig.tokenEnc, p);
        if (cfg.token) return Promise.resolve(cfg.token);
      } catch (e) { /* 口令无效则重试输入 */ }
    }
    return new Promise(function (resolve, reject) {
      modal("写作口令", "令牌已加密。请输入写作口令以启用保存功能：", "解锁", function (val) {
        if (!val) { reject(new Error("未输入口令")); return; }
        try {
          var t = decryptToken(siteConfig.tokenEnc, val);
          if (!t) throw new Error("解密失败");
          cfg.token = t;
          setPass(val);
          resolve(t);
        } catch (e) { reject(new Error("口令错误")); }
      }, false, true);
    });
  }

  /* 读 site-config.json（404 视为默认） */
  function loadConfig() {
    return rawGet(cfg.path + "/" + CONFIG_FILE).then(function (text) {
      try {
        var o = JSON.parse(text);
        siteConfig = {
          site: o.site || { name: "GL 层群宇宙", allowRegister: true },
          setupKey: o.setupKey || "",
          token: o.token || "",
          tokenEnc: o.tokenEnc || ""
        };
      } catch (e) { /* 保持默认 */ }
      cfg.token = decodeToken(siteConfig.token);
      return siteConfig;
    }).catch(function (e) {
      if (e.status === 404) return siteConfig;
      throw e;
    });
  }

  /* 写 users.json（带并发合并重试） */
  function updateUsers(mutator, msg) {
    function read() {
      return ensureToken().then(function () {
        return getFile(cfg.path + "/" + USERS_FILE).then(function (data) {
          var obj = JSON.parse(b64Decode(data.content));
          if (!Array.isArray(obj.users)) obj.users = [];
          return { obj: obj, sha: data.sha };
        }).catch(function (e) {
          if (e.status === 404) return { obj: { version: 1, users: [] }, sha: null };
          throw e;
        });
      });
    }
    function attempt() {
      return read().then(function (r) {
        mutator(r.obj.users);
        return putFile(cfg.path + "/" + USERS_FILE, JSON.stringify(r.obj, null, 2) + "\n", r.sha, msg);
      });
    }
    return attempt().catch(function (e) {
      if (e.status === 409) return attempt();
      throw e;
    });
  }

  function persistSession(u) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ u: u, at: Date.now() })); } catch (e) { /* 忽略 */ }
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* 忽略 */ }
  }

  function setAuth(user) {
    auth = user;
    persistSession(user.u);
    $("#user-chip").innerHTML = esc(user.display || user.u) + ' <span class="role">[' + esc(user.role) + "]</span>";
    $("#user-chip").classList.remove("hidden");
    $("#btn-admin").classList.toggle("hidden", !isAdmin());
    $("#topbar").classList.remove("hidden");
    $("#view-auth").classList.add("hidden");
    showView("list");
    loadList(true);
  }

  function logout() {
    auth = null;
    clearSession();
    $("#topbar").classList.add("hidden");
    showView("auth");
    renderAuthUI();
  }

  function authError(msg) {
    var el = $("#auth-err");
    el.classList.remove("hidden");
    el.textContent = msg;
  }
  function clearAuthError() {
    $("#auth-err").classList.add("hidden");
  }

  /* ---------------- 登录 ---------------- */

  function doLogin(u, pw) {
    clearAuthError();
    var user = findUser(u);
    if (!user || hashPw(user.salt, pw) !== user.hash) {
      authError("用户名或密码错误");
      return;
    }
    setAuth(user);
  }

  /* ---------------- 注册 ---------------- */

  function validateUsername(u) {
    return /^[a-z0-9_-]{2,20}$/.test(u);
  }

  function doRegister(u, display, pw, key) {
    clearAuthError();
    if (!validateUsername(u)) { authError("用户名需为 2-20 位小写字母/数字/_/-"); return; }
    if (!display || display.length > 20) { authError("昵称不能为空且不超过 20 字"); return; }
    if (!pw || pw.length < 6) { authError("密码至少 6 位"); return; }
    if (findUser(u)) { authError("用户名已被占用"); return; }
    if (!siteConfig.site.allowRegister && !key) { authError("站点当前未开放注册，请联系站长"); return; }

    var isFounder = !!(key && siteConfig.setupKey && key === siteConfig.setupKey);
    var hasAdmin = users.some(function (x) { return x.role === "admin"; });

    if (key && !isFounder) { authError("设立密钥不正确"); return; }
    if (isFounder && hasAdmin) { authError("站点已有站长账号，设立密钥仅用于首次创建"); return; }

    var salt = makeSalt();
    var newUser = {
      u: u,
      salt: salt,
      hash: hashPw(salt, pw),
      display: display,
      bio: "",
      role: isFounder ? "admin" : "pending",
      joined: today()
    };

    updateUsers(function (arr) {
      /* 去重后追加 */
      for (var i = arr.length - 1; i >= 0; i--) if (arr[i].u === u) arr.splice(i, 1);
      arr.push(newUser);
    }, "chore(gl-universe): 注册账号 " + u + (isFounder ? " (站长)" : " (待审核)") + " by " + u).then(function () {
      users.push(newUser);
      if (isFounder) {
        toast("站长账号已创建 ✓");
        setAuth(newUser);
      } else {
        toast("注册成功，等待站长审核");
        $("#a-u").value = u;
        switchAuthTab("login");
        $("#a-p").focus();
      }
    }).catch(function (e) {
      authError("注册失败: " + (e.message || e) + "\n> 提示: 站点写入令牌未配置或无效时无法注册，请联系站长。");
    });
  }

  /* ---------------- 站长初始化 ---------------- */

  function doBootstrap(key, token, u, display, pw) {
    clearAuthError();
    if (!key || !token || !u || !display || !pw) { authError("初始化需填写全部字段"); return; }
    if (!validateUsername(u)) { authError("站长用户名需为 2-20 位小写字母/数字/_/-"); return; }
    if (pw.length < 6) { authError("密码至少 6 位"); return; }

    cfg.token = token;
    var salt = makeSalt();
    var founder = {
      u: u, salt: salt, hash: hashPw(salt, pw),
      display: display, bio: "站长", role: "admin", joined: today()
    };

    var configJson = JSON.stringify({
      version: 1,
      site: { name: siteConfig.site.name || "GL 层群宇宙", allowRegister: true },
      setupKey: key,
      token: "",
      tokenEnc: encryptToken(token, key)
    }, null, 2);

    putFile(cfg.path + "/" + CONFIG_FILE, configJson, null, "chore(gl-universe): 站点初始化 by " + u).then(function () {
      siteConfig.setupKey = key;
      siteConfig.token = token;
      siteConfig.tokenEnc = encryptToken(token, key);
      setPass(key);
      return updateUsers(function (arr) {
        for (var i = arr.length - 1; i >= 0; i--) if (arr[i].u === u) arr.splice(i, 1);
        arr.push(founder);
      }, "chore(gl-universe): 创建站长账号 " + u + " by " + u);
    }).then(function () {
      users.push(founder);
      toast("站点初始化完成 ✓");
      setAuth(founder);
    }).catch(function (e) {
      authError("初始化失败: " + (e.message || e) + "\n> 提示: 请确认令牌对 content/ 目录有读写权限。");
    });
  }

  /* ================= 视图切换 ================= */

  function showView(name) {
    ["auth", "list", "edit", "admin", "profile"].forEach(function (v) {
      $("#view-" + v).classList.toggle("hidden", v !== name);
    });
    var bar = $("#actionbar");
    bar.classList.toggle("hidden", name !== "list" && name !== "edit");
    if (name === "edit") {
      $("#bar-refresh").textContent = "预览";
      $("#bar-new").textContent = "保存";
    } else {
      $("#bar-refresh").textContent = "↻ 刷新";
      $("#bar-new").textContent = "＋ 新建";
    }
    window.scrollTo(0, 0);
  }

  /* ================= 列表 ================= */

  function currentDir() { return cfg.path + "/" + DIRS[mode]; }

  function loadList(showBusy) {
    var meta = $("#list-meta");
    var errBox = $("#list-error");
    var emptyEl = $("#empty-state");
    if (showBusy) meta.textContent = "正在从 GitHub 拉取 ...";
    errBox.classList.add("hidden");
    return listDir(currentDir()).then(function (arr) {
      var files = Array.isArray(arr) ? arr.filter(function (f) { return f.type === "file"; }) : [];
      listItems = files.map(function (f) { return { name: f.name, path: f.path, sha: f.sha, size: f.size || 0 }; });
      meta.textContent = "共 " + listItems.length + " 条 · " + currentDir() + " · " + new Date().toLocaleTimeString("zh-CN");
      emptyEl.classList.toggle("hidden", listItems.length > 0);
      renderList();
      handlePageParam();
      return listItems;
    }).catch(function (e) {
      listItems = [];
      renderList();
      emptyEl.classList.add("hidden");
      errBox.classList.remove("hidden");
      errBox.innerHTML = "> 连接失败: " + esc(e.message || e) +
        "<br>→ 目录不存在是正常的，新建第一条内容会自动创建。" +
        "<br>→ 令牌失效或权限不足时请联系站长。";
      throw e;
    });
  }

  function renderList() {
    var ul = $("#item-list");
    ul.innerHTML = "";
    listItems.forEach(function (it) {
      var li = document.createElement("li");
      li.className = "item";
      var ext = it.name.split(".").pop();
      var size = it.size > 1024 ? (it.size / 1024).toFixed(1) + " KB" : it.size + " B";
      li.innerHTML =
        '<div class="item-title">' + esc(it.name) + "</div>" +
        '<div class="item-meta">' + esc(ext.toUpperCase()) + " · " + size + "</div>" +
        '<div class="item-ops">' +
        '<button type="button" data-act="edit">编辑</button>' +
        '<button type="button" data-act="dl">备份</button>' +
        '<button type="button" data-act="del" class="op-del">删除</button>' +
        "</div>";
      ul.appendChild(li);
    });
  }

  /* 从 ?page=<slug> 直达编辑 */
  function handlePageParam() {
    var slug = params.get("page");
    if (!slug) return;
    params.delete("page");
    var target = null;
    for (var i = 0; i < listItems.length; i++) {
      var it = listItems[i];
      if (it.name === slug || it.name === slug + ".json" || it.name === slug + ".md") { target = it; break; }
    }
    if (!target) { toast("未找到页面: " + slug, true); return; }
    openEdit(target);
  }

  /* ================= 编辑 ================= */

  function openNew() {
    editing = null;
    editingOldSlug = null;
    editingDate = null;
    previewOn = false;
    $("#save-banner").classList.add("hidden");
    showView("edit");
    if (mode === "archives") {
      $("#form-archive").classList.remove("hidden");
      $("#form-doc").classList.add("hidden");
      resetArchiveForm();
      $("#f-id").value = suggestId($("#f-cat").value, listItems);
      $("#edit-title").textContent = "新建档案卡片 · " + $("#f-id").value;
    } else {
      $("#form-doc").classList.remove("hidden");
      $("#form-archive").classList.add("hidden");
      resetDocForm();
      $("#d-id").value = suggestDocId(listItems);
      $("#edit-title").textContent = "新建长文档 · " + $("#d-id").value;
    }
    $("#preview-panel").classList.add("hidden");
  }

  function openEdit(it) {
    editing = it;
    editingOldSlug = null;
    editingDate = null;
    previewOn = false;
    $("#save-banner").classList.add("hidden");
    showView("edit");
    $("#list-meta").textContent = "正在读取 " + it.name + " ...";
    getFile(it.path).then(function (data) {
      var content = b64Decode(data.content || "");
      if (mode === "archives") {
        $("#form-archive").classList.remove("hidden");
        $("#form-doc").classList.add("hidden");
        var card = parseArchive(content);
        fillArchiveForm(card);
        editingDate = card.date || null;
        editingOldSlug = slugOf(card);
        $("#edit-title").textContent = "编辑 · " + (card.title || it.name);
      } else {
        $("#form-doc").classList.remove("hidden");
        $("#form-archive").classList.add("hidden");
        var doc = parseDoc(content);
        fillDocForm(doc);
        editingDate = doc.date || null;
        editingOldSlug = slugOf(doc);
        $("#edit-title").textContent = "编辑 · " + (doc.title || it.name);
      }
    }).catch(function (e) {
      toast("读取失败: " + (e.message || e), true);
      showView("list");
    });
  }

  /* ---------------- 表单 ---------------- */

  function resetArchiveForm() {
    $("#f-title").value = "";
    $("#f-cat").value = CATS[0];
    $("#f-tags").value = "";
    $("#f-author").value = auth ? auth.display : "";
    $("#f-body").value = "";
    $("#kv-box").innerHTML = "";
    addKvRow("全称", "");
    addKvRow("性质", "");
  }

  function addKvRow(k, v) {
    var box = $("#kv-box");
    var row = document.createElement("div");
    row.className = "kv-row";
    row.innerHTML =
      '<input class="finput kv-k" type="text" placeholder="字段名" value="' + esc(k || "") + '" autocomplete="off">' +
      '<textarea class="finput kv-v" rows="2" placeholder="字段内容"></textarea>' +
      '<button type="button" class="kv-del" aria-label="删除字段">×</button>';
    var va = row.querySelector(".kv-v");
    if (v !== undefined && v !== null) va.value = v;
    row.querySelector(".kv-del").addEventListener("click", function () { row.remove(); });
    box.appendChild(row);
  }

  function collectArchive() {
    var fields = [];
    $$("#kv-box .kv-row").forEach(function (row) {
      var k = row.querySelector(".kv-k").value.trim();
      var v = row.querySelector(".kv-v").value.trim();
      if (k) fields.push({ k: k, v: v });
    });
    return {
      id: $("#f-id").value.trim(),
      title: $("#f-title").value.trim(),
      category: $("#f-cat").value,
      tags: splitTags($("#f-tags").value),
      author: $("#f-author").value.trim(),
      date: editingDate || today(),
      fields: fields,
      body: $("#f-body").value
    };
  }

  function fillArchiveForm(card) {
    $("#f-id").value = card.id || "";
    $("#f-title").value = card.title || "";
    $("#f-cat").value = CATS.indexOf(card.category) >= 0 ? card.category : "其他";
    $("#f-tags").value = (card.tags || []).join(", ");
    $("#f-author").value = card.author || "";
    $("#f-body").value = card.body || "";
    $("#kv-box").innerHTML = "";
    var fs = card.fields && card.fields.length ? card.fields : [{ k: "", v: "" }];
    fs.forEach(function (f) { addKvRow(f.k, f.v); });
  }

  function parseArchive(text) {
    try {
      var o = JSON.parse(text);
      return {
        id: o.id || "", title: o.title || "", category: o.category || "",
        tags: Array.isArray(o.tags) ? o.tags : [],
        author: o.author || "", date: o.date || "",
        fields: Array.isArray(o.fields) ? o.fields : [], body: o.body || ""
      };
    } catch (e) {
      return { id: "", title: "", category: "", tags: [], author: "", fields: [], body: "" };
    }
  }

  function splitTags(s) {
    return String(s || "").split(/[,，;；\s]+/).map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function parseFrontMatter(text) {
    var m = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { meta: {}, body: text };
    var meta = {};
    m[1].split("\n").forEach(function (line) {
      var i = line.indexOf(":");
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    return { meta: meta, body: m[2] };
  }

  function buildFrontMatter(meta) {
    return "---\n" + Object.keys(meta).map(function (k) { return k + ": " + meta[k]; }).join("\n") + "\n---\n\n";
  }

  function parseDoc(text) {
    var fm = parseFrontMatter(text);
    var m = fm.meta;
    return {
      id: m.id || "", title: m.title || "", category: m.category || "",
      tags: m.tags ? String(m.tags).split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean) : [],
      author: m.author || "", date: m.date || "",
      body: fm.body
    };
  }

  function resetDocForm() {
    $("#d-title").value = "";
    $("#d-cat").value = CATS[0];
    $("#d-tags").value = "";
    $("#d-author").value = auth ? auth.display : "";
    $("#d-content").value = "";
  }

  function collectDoc() {
    return {
      id: $("#d-id").value.trim(),
      title: $("#d-title").value.trim(),
      category: $("#d-cat").value,
      tags: splitTags($("#d-tags").value),
      author: $("#d-author").value.trim(),
      date: editingDate || today(),
      body: $("#d-content").value
    };
  }

  function fillDocForm(doc) {
    $("#d-id").value = doc.id || "";
    $("#d-title").value = doc.title || "";
    $("#d-cat").value = CATS.indexOf(doc.category) >= 0 ? doc.category : "其他";
    $("#d-tags").value = (doc.tags || []).join(", ");
    $("#d-author").value = doc.author || "";
    $("#d-content").value = doc.body || "";
  }

  /* ---------------- ID 生成 ---------------- */

  function suggestId(cat, items) {
    var prefix = CAT_PREFIX[cat] || "GL-OTH";
    var max = 0;
    (items || []).forEach(function (f) {
      var m = f.name.match(/^GL-(\w+)-(\d+)/);
      if (m && "GL-" + m[1] === prefix) max = Math.max(max, parseInt(m[2], 10));
    });
    return prefix + "-" + String(max + 1).padStart(3, "0");
  }

  function suggestDocId(items) {
    var max = 0;
    (items || []).forEach(function (f) {
      var m = f.name.match(/^GL-DOC-(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return "GL-DOC-" + String(max + 1).padStart(3, "0");
  }

  /* ---------------- 预览 ---------------- */

  function renderCardHTML(card) {
    var tags = (card.tags || []).map(function (t) { return "#" + esc(t); }).join(" ");
    var h =
      '<div class="pv-card">' +
      '<div class="pv-card-head"><span class="pv-id">' + esc(card.id || "?") + "</span>" +
      '<span class="pv-cat">' + esc(card.category || "其他") + "</span></div>" +
      '<div class="pv-title">' + esc(card.title || "(未命名)") + "</div>" +
      '<div class="pv-meta">作者: ' + esc(card.author || "佚名") + " · " + esc(card.date || "") + (tags ? " · " + tags : "") + "</div>";
    (card.fields || []).forEach(function (f) {
      if (!f || !f.k) return;
      h += '<div class="pv-fields"><span class="pv-k">' + esc(f.k) + ": </span><span class=\"pv-v\">" + esc(f.v) + "</span></div>";
    });
    if (card.body && card.body.trim()) h += '<div class="md-body">' + mdRender(card.body) + "</div>";
    h += "</div>";
    return h;
  }

  function renderDocHTML(doc) {
    var tags = (doc.tags || []).map(function (t) { return "#" + esc(t); }).join(" ");
    return (
      '<div class="pv-card">' +
      '<div class="pv-card-head"><span class="pv-id">' + esc(doc.id || "?") + "</span>" +
      '<span class="pv-cat">' + esc(doc.category || "其他") + "</span></div>" +
      '<div class="pv-title">' + esc(doc.title || "(未命名)") + "</div>" +
      '<div class="pv-meta">作者: ' + esc(doc.author || "佚名") + " · " + esc(doc.date || "") + (tags ? " · " + tags : "") + "</div>" +
      '<div class="md-body">' + mdRender(doc.body) + "</div>" +
      "</div>"
    );
  }

  function togglePreview() {
    var panel = $("#preview-panel");
    var isDoc = mode === "docs";
    if (previewOn) {
      previewOn = false;
      panel.classList.add("hidden");
      $("#form-" + (isDoc ? "doc" : "archive")).classList.remove("hidden");
      $("#bar-refresh").textContent = "预览";
      return;
    }
    var html = isDoc ? renderDocHTML(collectDoc()) : renderCardHTML(collectArchive());
    panel.innerHTML = '<div class="pv-tip mono dim">—— 预览 ——</div>' + html;
    panel.classList.remove("hidden");
    $("#form-" + (isDoc ? "doc" : "archive")).classList.add("hidden");
    $("#bar-refresh").textContent = "✎ 编辑";
    previewOn = true;
    window.scrollTo(0, 0);
  }

  /* ================= 保存 / 删除 / 备份 ================= */

  function buildFileName() {
    var id = window.GLPage.sanitize(mode === "archives" ? $("#f-id").value : $("#d-id").value);
    return (id || "untitled") + (mode === "archives" ? ".json" : ".md");
  }

  function buildContent() {
    if (mode === "archives") return JSON.stringify(collectArchive(), null, 2) + "\n";
    var d = collectDoc();
    var meta = {
      id: d.id, title: d.title, category: d.category,
      tags: (d.tags || []).join(", "), author: d.author, date: d.date
    };
    return buildFrontMatter(meta) + d.body.replace(/^\n+/, "");
  }

  function buildCommitMsg(action) {
    var id = mode === "archives" ? $("#f-id").value.trim() : $("#d-id").value.trim();
    var title = mode === "archives" ? $("#f-title").value.trim() : $("#d-title").value.trim();
    return "feat(gl-universe): " + action + " " + (id || "untitled") + (title ? " · " + title : "") + " by " + (auth ? auth.u : "?");
  }

  /* 生成并提交独立页面 w/<slug>.html */
  function publishPage(meta, contentHtml, isNew) {
    var slug = slugOf(meta);
    var path = cfg.path + "/" + W_DIR + "/" + slug + ".html";
    var html = window.GLPage.buildPageHTML(meta, contentHtml, { siteName: siteConfig.site.name });
    var msg = "feat(gl-universe): 生成页面 " + slug + " by " + (auth ? auth.u : "?");
    return putFile(path, html, null, msg).then(function () {
      /* 标题改动时清理旧页面 */
      if (!isNew && editingOldSlug && editingOldSlug !== slug) {
        return listDir(cfg.path + "/" + W_DIR).then(function (arr) {
          var old = null;
          if (Array.isArray(arr)) arr.forEach(function (f) {
            if (f.name === editingOldSlug + ".html") old = f;
          });
          if (old) return delFile(old.path, old.sha, "chore(gl-universe): 页面改名 " + editingOldSlug + " → " + slug);
        }).catch(function () { /* 忽略清理失败 */ });
      }
    });
  }

  /* 重新生成 w/index.html 页面索引 */
  function rebuildIndex() {
    var dirs = [cfg.path + "/archives", cfg.path + "/docs"];
    var all = [];
    return Promise.all(dirs.map(listDir)).then(function (results) {
      results.forEach(function (arr, i) {
        if (!Array.isArray(arr)) return;
        arr.forEach(function (f) {
          if (f.type === "file") all.push({ type: i === 0 ? "archives" : "docs", name: f.name, path: f.path });
        });
      });
      return Promise.all(all.map(function (it) {
        return getFile(it.path).then(function (data) {
          var text = b64Decode(data.content || "");
          var meta = it.type === "archives" ? parseArchive(text) : parseDoc(text);
          it.meta = meta;
          return it;
        }).catch(function () { it.meta = null; return it; });
      }));
    }).then(function (items) {
      var lis = items.filter(function (it) { return it.meta && (it.meta.title || it.meta.id); })
        .sort(function (a, b) {
          var da = a.meta.date || "", db = b.meta.date || "";
          if (da !== db) return da < db ? 1 : -1;
          return a.name < b.name ? -1 : 1;
        })
        .map(function (it) {
          var slug = slugOf(it.meta);
          return '<li><a href="' + encodeURIComponent(slug) + '.html">' + esc(it.meta.title || it.meta.id) +
            '</a> <span class="ix-meta">' + esc(it.meta.category || "其他") + " · " + esc(it.meta.author || "") + " · " + esc(it.meta.date || "") + "</span></li>";
        }).join("\n");
      var html = indexPageHTML(lis);
      return putFile(cfg.path + "/" + W_DIR + "/index.html", html, null,
        "chore(gl-universe): 更新页面索引 by " + (auth ? auth.u : "?"));
    });
  }

  function indexPageHTML(lis) {
    return '<!DOCTYPE html>\n' +
      '<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n' +
      '<meta name="theme-color" content="#010402">\n' +
      '<title>页面索引 · ' + esc(siteConfig.site.name) + "</title>\n" +
      '<link rel="stylesheet" href="../css/style.css">\n' +
      '<style>\n' +
      ".ix{max-width:760px;margin:0 auto;padding:24px 14px;}\n" +
      ".ix h1{font-size:18px;color:var(--fg-bright);margin-bottom:14px;}\n" +
      ".ix ul{list-style:none;}\n" +
      ".ix li{border-bottom:1px dotted var(--line-dim);padding:10px 2px;}\n" +
      ".ix a{color:var(--fg-bright);font-size:15px;text-decoration:none;}\n" +
      ".ix-meta{color:var(--fg-dim);font-size:12px;margin-left:8px;}\n" +
      ".ix-foot{text-align:center;color:var(--fg-dim);font-size:12px;margin-top:20px;}\n" +
      ".ix-foot a{color:var(--fg-bright);}\n" +
      "</style>\n</head>\n<body>\n" +
      '<div class="ix mono">\n' +
      "<h1>$ ls 页面/</h1>\n" +
      (lis ? "<ul>\n" + lis + "\n</ul>" : '<p class="ix-foot">暂无页面</p>') +
      '<div class="ix-foot"><a href="../archive.html">← 档案库</a> · <a href="../index.html">R.O.R 终端</a></div>\n' +
      "</div>\n</body>\n</html>";
  }

  function showSaveBanner(slug) {
    var banner = $("#save-banner");
    var url = "../" + pageURL(slug);
    banner.innerHTML =
      '<button type="button" class="close-x" aria-label="关闭">×</button>' +
      "✓ 已保存并生成独立页面<br>" +
      '<a href="' + url + '" target="_blank" rel="noopener">打开页面 ▸ ' + esc(pageURL(slug)) + "</a>" +
      "<br><span class=\"dim\">完整网址: " + esc((GL.config && GL.config.siteUrl || "") + pageURL(slug)) + "</span>";
    banner.classList.remove("hidden");
  }

  function doSave() {
    if (!canWrite()) { toast("账号待审核，暂不能创作", true); return; }
    var fname = buildFileName();
    var path = currentDir() + "/" + fname;
    var content = buildContent();
    var isNew = !editing;
    var meta = mode === "archives" ? collectArchive() : collectDoc();
    var slug = slugOf(meta);
    var msg = buildCommitMsg(isNew ? "新增档案" : "更新档案");

    if (!meta.title) { toast("请先填写标题（用于生成页面网址）", true); return; }

    /* 标题冲突检测: 新页面时避免覆盖他人页面 */
    var slugCheck = isNew ? listDir(cfg.path + "/" + W_DIR).catch(function () { return []; }) : Promise.resolve([]);
    slugCheck.then(function (arr) {
      var exists = Array.isArray(arr) && arr.some(function (f) { return f.type === "file" && f.name === slug + ".html"; });
      if (exists) slug = uniqueSlug(slug, arr);
      return putFile(path, content, editing ? editing.sha : null, msg);
    }).then(function () {
      editing = null;
      editingOldSlug = null;
      return publishPage(meta, mode === "archives" ? renderCardHTML(meta) : renderDocHTML(meta), isNew);
    }).then(function () {
      return rebuildIndex().catch(function () { /* 索引失败不阻塞 */ });
    }).then(function () {
      toast("已保存 ✓");
      showSaveBanner(slug);
      showView("list");
      loadList(false);
    }).catch(function (e) {
      toast("保存失败: " + (e.message || e), true);
    });
  }

  function uniqueSlug(base, files) {
    var n = 2;
    while (files.some(function (f) { return f.name === base + "-" + n + ".html"; })) n++;
    return base + "-" + n;
  }

  function doDelete(it) {
    var slug = it.name.replace(/\.(json|md)$/, "");
    modal("确认删除", "确定要删除 <b>" + esc(it.name) + "</b> 及其独立页面吗？\n此操作将直接提交到 GitHub，无法撤销。", "删除", function () {
      delFile(it.path, it.sha, "chore(gl-universe): 删除档案 " + it.name + " by " + (auth ? auth.u : "?")).then(function () {
        return listDir(cfg.path + "/" + W_DIR).catch(function () { return []; });
      }).then(function (arr) {
        var wp = null;
        if (Array.isArray(arr)) arr.forEach(function (f) { if (f.name === slug + ".html") wp = f; });
        if (wp) return delFile(wp.path, wp.sha, "chore(gl-universe): 删除页面 " + slug + ".html");
      }).then(function () {
        return rebuildIndex().catch(function () {});
      }).then(function () {
        toast("已删除");
        return loadList(false);
      }).catch(function (e) {
        toast("删除失败: " + (e.message || e), true);
      });
    }, true);
  }

  function download(name, content) {
    try {
      var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
      toast("已下载备份: " + name);
    } catch (e) {
      toast("下载失败: " + (e.message || e), true);
    }
  }

  function backupCurrent() {
    if (!editing) {
      download(buildFileName(), buildContent());
      return;
    }
    getFile(editing.path).then(function (data) {
      download(editing.name, b64Decode(data.content || ""));
    }).catch(function (e) {
      toast("读取失败: " + (e.message || e), true);
    });
  }

  /* ================= 管理后台 ================= */

  function renderAdmin() {
    renderPending();
    renderUsers();
    fillConfigForm();
  }

  function renderPending() {
    var box = $("#admin-pending");
    var pend = users.filter(function (x) { return x.role === "pending"; });
    box.innerHTML = "";
    $("#admin-pending-empty").classList.toggle("hidden", pend.length > 0);
    pend.forEach(function (u2) {
      var el = document.createElement("div");
      el.className = "admin-user";
      el.innerHTML =
        '<div class="au-main"><span class="au-name">' + esc(u2.u) + "</span>" +
        '<span class="au-role pending">待审核</span></div>' +
        '<div class="au-meta">昵称: ' + esc(u2.display) + " · 注册于 " + esc(u2.joined) + "</div>" +
        '<div class="au-ops">' +
        '<button type="button" data-op="ok" data-u="' + esc(u2.u) + '" class="au-ok">批准</button>' +
        '<button type="button" data-op="rej" data-u="' + esc(u2.u) + '" class="au-del">拒绝</button>' +
        "</div>";
      box.appendChild(el);
    });
  }

  function renderUsers() {
    var box = $("#admin-users");
    box.innerHTML = "";
    users.forEach(function (u2) {
      if (u2.role === "pending") return;
      var el = document.createElement("div");
      el.className = "admin-user";
      el.innerHTML =
        '<div class="au-main"><span class="au-name">' + esc(u2.display || u2.u) + "</span>" +
        '<span class="au-meta"> @' + esc(u2.u) + "</span>" +
        '<span class="au-role ' + esc(u2.role) + '">' + esc(u2.role) + "</span></div>" +
        '<div class="au-meta">' + esc(u2.bio || "") + " · 加入于 " + esc(u2.joined) + "</div>" +
        '<div class="au-ops">' +
        '<select data-op="role" data-u="' + esc(u2.u) + '">' +
        '<option value="author"' + (u2.role === "author" ? " selected" : "") + ">作者</option>" +
        '<option value="admin"' + (u2.role === "admin" ? " selected" : "") + ">站长</option>" +
        "</select>" +
        '<button type="button" data-op="pw" data-u="' + esc(u2.u) + '">重置密码</button>' +
        '<button type="button" data-op="del" data-u="' + esc(u2.u) + '" class="au-del">删除</button>' +
        "</div>";
      box.appendChild(el);
    });
  }

  function adminOp(e) {
    var el = e.target.closest ? e.target.closest("[data-op]") : null;
    if (!el) return;
    var u2 = el.dataset.u;
    var op = el.dataset.op;
    if (op === "ok") {
      updateUsers(function (arr) {
        arr.forEach(function (x) { if (x.u === u2) x.role = "author"; });
      }, "chore(gl-universe): 批准注册 " + u2 + " by " + auth.u).then(function () {
        users.forEach(function (x) { if (x.u === u2) x.role = "author"; });
        toast("已批准 " + u2);
        renderAdmin();
      }).catch(function (e2) { toast("操作失败: " + (e2.message || e2), true); });
    } else if (op === "rej") {
      modal("拒绝注册", "确定拒绝 <b>" + esc(u2) + "</b> 的注册申请并删除记录？", "拒绝", function () {
        updateUsers(function (arr) {
          for (var i = arr.length - 1; i >= 0; i--) if (arr[i].u === u2) arr.splice(i, 1);
        }, "chore(gl-universe): 拒绝注册 " + u2 + " by " + auth.u).then(function () {
          users = users.filter(function (x) { return x.u !== u2; });
          toast("已拒绝");
          renderAdmin();
        }).catch(function (e2) { toast("操作失败: " + (e2.message || e2), true); });
      }, true);
    } else if (op === "role") {
      var role = el.value;
      updateUsers(function (arr) {
        arr.forEach(function (x) { if (x.u === u2) x.role = role; });
      }, "chore(gl-universe): 修改权限 " + u2 + " → " + role + " by " + auth.u).then(function () {
        users.forEach(function (x) { if (x.u === u2) x.role = role; });
        toast("已更新 " + u2);
      }).catch(function (e2) { toast("操作失败: " + (e2.message || e2), true); });
    } else if (op === "pw") {
      modal("重置密码", "为 <b>" + esc(u2) + "</b> 设置新密码（至少 6 位）:", "重置", function (pw) {
        if (!pw || pw.length < 6) { toast("密码至少 6 位", true); return; }
        var salt = makeSalt();
        updateUsers(function (arr) {
          arr.forEach(function (x) { if (x.u === u2) { x.salt = salt; x.hash = hashPw(salt, pw); } });
        }, "chore(gl-universe): 重置密码 " + u2 + " by " + auth.u).then(function () {
          toast("密码已重置");
        }).catch(function (e2) { toast("操作失败: " + (e2.message || e2), true); });
      }, true, true);
    } else if (op === "del") {
      modal("删除用户", "确定删除用户 <b>" + esc(u2) + "</b>？其页面将保留（作者署名不变）。", "删除", function () {
        updateUsers(function (arr) {
          for (var i = arr.length - 1; i >= 0; i--) if (arr[i].u === u2) arr.splice(i, 1);
        }, "chore(gl-universe): 删除用户 " + u2 + " by " + auth.u).then(function () {
          users = users.filter(function (x) { return x.u !== u2; });
          toast("已删除");
          renderAdmin();
        }).catch(function (e2) { toast("操作失败: " + (e2.message || e2), true); });
      }, true);
    }
  }

  /* ---------------- 系统配置 ---------------- */

  function fillConfigForm() {
    $("#c-name").value = siteConfig.site.name;
    $("#c-reg").checked = !!siteConfig.site.allowRegister;
    $("#c-token").value = siteConfig.token;
    $("#c-pass").value = getPass() || "";
    $("#c-key").value = siteConfig.setupKey;
    $("#c-repo").value = cfg.repo;
    $("#c-path").value = cfg.path;
  }

  function saveConfig() {
    var res = $("#c-result");
    siteConfig.site.name = $("#c-name").value.trim() || "GL 层群宇宙";
    siteConfig.site.allowRegister = $("#c-reg").checked;
    var newToken = $("#c-token").value.trim();
    var pass = $("#c-pass").value.trim();
    if (newToken && !pass) {
      res.className = "s-result err";
      res.textContent = "> 请输入写作口令（用于加密令牌）。";
      return;
    }
    if (newToken && pass) {
      siteConfig.tokenEnc = encryptToken(newToken, pass);
      siteConfig.token = "";
      cfg.token = newToken;
      setPass(pass);
    } else if (pass) {
      /* 仅更新口令: 重新加密现有令牌 */
      if (siteConfig.tokenEnc && cfg.token) {
        siteConfig.tokenEnc = encryptToken(cfg.token, pass);
        setPass(pass);
      }
    }
    siteConfig.setupKey = $("#c-key").value.trim();
    cfg.repo = $("#c-repo").value.trim() || DEFAULTS.repo;
    cfg.path = ($("#c-path").value.trim() || DEFAULTS.path).replace(/\/+$/, "");
    saveMeta();

    var configJson = JSON.stringify({
      version: 1,
      site: siteConfig.site,
      setupKey: siteConfig.setupKey,
      token: siteConfig.token,
      tokenEnc: siteConfig.tokenEnc
    }, null, 2);
    putFile(cfg.path + "/" + CONFIG_FILE, configJson, null, "chore(gl-universe): 更新站点配置 by " + auth.u).then(function () {
      res.className = "s-result ok";
      res.textContent = "> 配置已保存并提交到 GitHub ✓";
      toast("配置已保存");
    }).catch(function (e) {
      res.className = "s-result err";
      res.textContent = "> 保存失败: " + (e.message || e);
      toast("配置保存失败", true);
    });
  }

  /* ---------------- 我的资料 ---------------- */

  function fillProfile() {
    $("#p-u").value = auth.u;
    $("#p-d").value = auth.display || "";
    $("#p-bio").value = auth.bio || "";
  }

  function saveProfile() {
    var display = $("#p-d").value.trim();
    var bio = $("#p-bio").value.trim();
    var res = $("#p-result");
    if (!display) { res.className = "s-result err"; res.textContent = "> 昵称不能为空"; return; }
    updateUsers(function (arr) {
      arr.forEach(function (x) {
        if (x.u === auth.u) { x.display = display; x.bio = bio; }
      });
    }, "chore(gl-universe): 更新资料 " + auth.u + " by " + auth.u).then(function () {
      auth.display = display;
      auth.bio = bio;
      users.forEach(function (x) { if (x.u === auth.u) { x.display = display; x.bio = bio; } });
      $("#user-chip").innerHTML = esc(display) + ' <span class="role">[' + esc(auth.role) + "]</span>";
      res.className = "s-result ok";
      res.textContent = "> 资料已更新 ✓";
      toast("资料已更新");
    }).catch(function (e) {
      res.className = "s-result err";
      res.textContent = "> 保存失败: " + (e.message || e);
    });
  }

  /* ================= 弹窗（支持输入） ================= */

  var modalCb = null;
  function modal(title, msgHtml, okLabel, onOk, danger, withInput) {
    $("#modal-title").textContent = title;
    $("#modal-msg").innerHTML = msgHtml;
    $("#modal-ok").textContent = okLabel || "确认";
    $("#modal-ok").className = "btn" + (danger ? " btn-danger" : " btn-primary");
    var inp = $("#modal-input");
    inp.classList.toggle("hidden", !withInput);
    if (withInput) inp.value = "";
    modalCb = onOk || null;
    $("#modal").classList.remove("hidden");
    if (withInput) setTimeout(function () { inp.focus(); }, 60);
  }
  function closeModal() {
    $("#modal").classList.add("hidden");
    modalCb = null;
  }

  /* ================= 事件绑定 ================= */

  /* 登录/注册页签 */
  function switchAuthTab(name) {
    $$(".auth-tab").forEach(function (t) { t.classList.toggle("active", t.dataset.auth === name); });
    $("#form-login").classList.toggle("hidden", name !== "login");
    $("#form-register").classList.toggle("hidden", name !== "register");
    clearAuthError();
  }
  $$(".auth-tab").forEach(function (tab) {
    tab.addEventListener("click", function () { switchAuthTab(tab.dataset.auth); });
  });

  $("#form-login").addEventListener("submit", function (e) {
    e.preventDefault();
    doLogin($("#a-u").value.trim().toLowerCase(), $("#a-p").value);
  });
  $("#form-register").addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = $("#r-p").value;
    if (pw !== $("#r-p2").value) { authError("两次输入的密码不一致"); return; }
    doRegister($("#r-u").value.trim().toLowerCase(), $("#r-d").value.trim(), pw, $("#r-key").value.trim());
  });
  $("#form-bootstrap").addEventListener("submit", function (e) {
    e.preventDefault();
    doBootstrap($("#b-key").value.trim(), $("#b-token").value.trim(), $("#b-u").value.trim().toLowerCase(), $("#b-d").value.trim(), $("#b-p").value);
  });

  /* 列表页签 */
  $$(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      $$(".tab").forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      mode = tab.dataset.mode;
      editing = null;
      showView("list");
      loadList(true);
    });
  });

  /* 列表操作 */
  $("#item-list").addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("button[data-act]") : null;
    if (!btn) return;
    var li = btn.closest(".item");
    var idx = Array.prototype.indexOf.call($("#item-list").children, li);
    var it = listItems[idx];
    if (!it) return;
    var act = btn.dataset.act;
    if (act === "edit") openEdit(it);
    else if (act === "dl") {
      getFile(it.path).then(function (data) {
        download(it.name, b64Decode(data.content || ""));
      }).catch(function (err) { toast("读取失败: " + (err.message || err), true); });
    }
    else if (act === "del") doDelete(it);
  });

  /* 底部栏 */
  $("#bar-refresh").addEventListener("click", function () {
    if (!$("#view-edit").classList.contains("hidden")) { togglePreview(); return; }
    loadList(true);
  });
  $("#bar-new").addEventListener("click", function () {
    if (!$("#view-edit").classList.contains("hidden")) { doSave(); return; }
    if (!canWrite()) { toast("账号待审核，暂不能创作", true); return; }
    openNew();
  });

  /* 编辑页头部 */
  $("#btn-back").addEventListener("click", function () {
    editing = null;
    editingOldSlug = null;
    previewOn = false;
    $("#save-banner").classList.add("hidden");
    showView("list");
    loadList(false);
  });
  $("#btn-dl").addEventListener("click", backupCurrent);
  $("#kv-add").addEventListener("click", function () { addKvRow("", ""); });

  ["#f-cat", "#d-cat"].forEach(function (sel) {
    $(sel).addEventListener("change", function () {
      if (sel === "#f-cat") {
        var idEl = $("#f-id");
        if (!idEl.value.trim()) idEl.value = suggestId(this.value, listItems);
      }
    });
  });

  $("#save-banner").addEventListener("click", function (e) {
    if (e.target.classList.contains("close-x")) this.classList.add("hidden");
  });

  /* 顶栏 */
  $("#btn-admin").addEventListener("click", function () {
    renderAdmin();
    showView("admin");
  });
  $("#btn-admin-back").addEventListener("click", function () { showView("list"); loadList(false); });
  $("#btn-logout").addEventListener("click", function () {
    modal("退出登录", "确定退出当前账号？", "退出", logout, false);
  });

  /* 管理后台操作（事件委托） */
  $("#view-admin").addEventListener("change", adminOp);
  $("#view-admin").addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("button[data-op]") : null;
    if (el) adminOp(e);
  });

  $("#c-save").addEventListener("click", saveConfig);
  $("#c-reset").addEventListener("click", function () {
    cfg = { repo: DEFAULTS.repo, path: DEFAULTS.path, token: siteConfig.token };
    saveMeta();
    fillConfigForm();
    $("#c-result").className = "s-result ok";
    $("#c-result").textContent = "> 已恢复默认仓库与路径（站点配置不变）。";
  });

  /* 资料 */
  $("#btn-profile-back").addEventListener("click", function () { showView("list"); });
  $("#p-save").addEventListener("click", saveProfile);
  $("#p-logout").addEventListener("click", logout);
  $("#user-chip").addEventListener("click", function () {
    fillProfile();
    $("#p-result").className = "s-result";
    $("#p-result").textContent = "";
    showView("profile");
  });

  /* 弹窗 */
  $("#modal-cancel").addEventListener("click", closeModal);
  $("#modal-ok").addEventListener("click", function () {
    var cb = modalCb;
    var inp = $("#modal-input");
    var val = inp.classList.contains("hidden") ? null : inp.value;
    closeModal();
    if (cb) cb(val);
  });
  $("#modal").addEventListener("click", function (e) {
    if (e.target === this) closeModal();
  });
  $("#modal-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("#modal-ok").click();
  });

  /* 软键盘 */
  var isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  if (isTouch) {
    document.addEventListener("focusin", function (e) {
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) document.body.classList.add("kb-open");
    });
    document.addEventListener("focusout", function (e) {
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) document.body.classList.remove("kb-open");
    });
  }

  /* ================= 启动 ================= */

  function renderAuthUI() {
    var hasAdmin = users.some(function (x) { return x.role === "admin"; });
    var st = $("#auth-status");
    if (!hasAdmin) {
      st.textContent = "> 站点尚未初始化：请使用下方「站长初始化」创建站长账号";
      $("#bootstrap").classList.remove("hidden");
    } else {
      st.textContent = "> " + esc(siteConfig.site.name || "GL 层群宇宙") +
        " · 注册: " + (siteConfig.site.allowRegister ? "开放(需审核)" : "关闭") +
        " · 已有 " + users.filter(function (x) { return x.role === "admin" || x.role === "author"; }).length + " 位作者";
      $("#bootstrap").classList.add("hidden");
    }
    switchAuthTab("login");
  }

  function boot() {
    loadMeta();
    loadConfig().then(function () {
      return loadUsers();
    }).then(function () {
      /* 会话恢复 */
      var sess = null;
      try { sess = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { sess = null; }
      if (sess && sess.u) {
        var user = findUser(sess.u);
        if (user) {
          setAuth(user);
          return;
        }
      }
      showView("auth");
      renderAuthUI();
    }).catch(function (e) {
      var st = $("#auth-status");
      st.textContent = "> 无法连接 GitHub: " + (e.message || e) + "\n> 请检查网络后刷新页面。";
      showView("auth");
      switchAuthTab("login");
    });
  }

  /* 初始化分类下拉 */
  var catSel = $("#f-cat");
  var dcatSel = $("#d-cat");
  CATS.forEach(function (c) {
    catSel.insertAdjacentHTML("beforeend", '<option value="' + c + '">' + c + "</option>");
    dcatSel.insertAdjacentHTML("beforeend", '<option value="' + c + '">' + c + "</option>");
  });

  boot();
})();