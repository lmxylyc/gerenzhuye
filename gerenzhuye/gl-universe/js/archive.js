/* ==========================================================
   GL 档案库 · 展示脚本
   从 GitHub content/ 目录拉取档案卡片(JSON)与长文档(MD),
   本地渲染 / 搜索 / 分类筛选 / 展开阅读
   未认证 API 每小时 60 次配额 -> sessionStorage 缓存 10 分钟
   ========================================================== */
(function () {
  "use strict";

  var CFG = (window.GL && window.GL.config) || {};
  var REPO = CFG.repo || "lmxylyc/gerenzhuye";
  var CONTENT_PATH = CFG.contentPath || "gerenzhuye/gl-universe/content";
  var CACHE_KEY = "gl_archive_cache_v1";
  var CACHE_TTL = 10 * 60 * 1000; // 10 分钟

  var params = new URLSearchParams(window.location.search);
  if (params.get("repo")) REPO = params.get("repo");
  if (params.get("path")) CONTENT_PATH = params.get("path");

  var state = {
    tab: "all",
    q: "",
    cat: "",
    items: [] // {type:'archives'|'docs', name, path, meta, body}
  };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }

  /* ================= 数据获取 ================= */

  function apiContents(dir) {
    return fetch("https://api.github.com/repos/" + REPO + "/contents/" + encPath(dir), {
      headers: { Accept: "application/vnd.github+json" }
    }).then(function (r) {
      if (r.status === 404) return [];
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (arr) {
      return Array.isArray(arr) ? arr.filter(function (f) { return f.type === "file"; }) : [];
    });
  }

  function rawContent(path) {
    /* 优先同源(站点CDN), 失败回退 raw.githubusercontent */
    var rel = "";
    if (CONTENT_PATH && path.indexOf(CONTENT_PATH + "/") === 0) {
      rel = "content/" + path.slice(CONTENT_PATH.length + 1);
    }
    if (rel) {
      return fetch(rel, { cache: "no-store" }).then(function (r) {
        if (r.ok) return r.text();
        throw new Error("HTTP " + r.status);
      }).catch(function () {
        return fetch("https://raw.githubusercontent.com/" + REPO + "/HEAD/" + encPath(path), { cache: "no-store" })
          .then(function (r2) {
            if (!r2.ok) throw new Error("HTTP " + r2.status);
            return r2.text();
          });
      });
    }
    return fetch("https://raw.githubusercontent.com/" + REPO + "/HEAD/" + encPath(path), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      });
  }

  function loadCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || !c.t || Date.now() - c.t > CACHE_TTL) return null;
      return c;
    } catch (e) { return null; }
  }

  function saveCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), items: data }));
    } catch (e) { /* 容量不足时忽略 */ }
  }

  /* 解析 */
  function parseArchive(text) {
    try {
      var o = JSON.parse(text);
      return {
        id: o.id || "", title: o.title || "", category: o.category || "",
        tags: Array.isArray(o.tags) ? o.tags : [],
        author: o.author || "", date: o.date || "",
        fields: Array.isArray(o.fields) ? o.fields : [], body: o.body || ""
      };
    } catch (e) { return null; }
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

  function parseDoc(text) {
    var fm = parseFrontMatter(text);
    var m = fm.meta;
    return {
      id: m.id || "", title: m.title || "", category: m.category || "",
      tags: m.tags ? String(m.tags).split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean) : [],
      author: m.author || "", date: m.date || "",
      fields: [], body: fm.body
    };
  }

  function loadAll() {
    var cached = loadCache();
    if (cached && cached.items && cached.items.length) {
      state.items = cached.items;
      render();
      $("#arc-count").textContent = "共 " + state.items.length + " 条（缓存）";
      return;
    }

    $("#arc-list").innerHTML = '<div class="arc-loading mono">> 正在连接业力场 ...</div>';

    var dirs = { archives: "archives", docs: "docs" };
    Promise.all([apiContents(CONTENT_PATH + "/archives"), apiContents(CONTENT_PATH + "/docs")])
      .then(function (results) {
        var all = results[0].map(function (f) { return { type: "archives", name: f.name, path: f.path }; })
          .concat(results[1].map(function (f) { return { type: "docs", name: f.name, path: f.path }; }));
        if (!all.length) {
          state.items = [];
          render();
          return;
        }
        return Promise.all(all.map(function (it) {
          return rawContent(it.path).then(function (text) {
            it.meta = it.type === "archives" ? parseArchive(text) : parseDoc(text);
            it.body = it.meta ? it.meta.body : "";
            return it;
          }).catch(function () {
            it.meta = null;
            it.body = "";
            return it;
          });
        })).then(function (items) {
          state.items = items.filter(function (it) { return it.meta; });
          saveCache(state.items);
          render();
        });
      })
      .catch(function (e) {
        var err = $("#arc-err");
        err.classList.remove("hidden");
        err.textContent = "> 连接 GitHub 失败: " + (e && e.message ? e.message : e) +
          "\n> 未认证 API 限速 60 次/小时, 稍后自动重试或刷新页面。" +
          "\n> 若仓库已改名/移动, 可在网址后加 ?repo=owner/name&path=路径 指定。";
        $("#arc-count").textContent = "同步失败";
      });
  }

  /* ================= 渲染 ================= */

  function cardHTML(it) {
    var m = it.meta;
    var cat = m.category || "其他";
    var tags = (m.tags || []).map(function (t) { return "#" + esc(t); }).join(" ");
    var h =
      '<div class="arc-id">' + esc(m.id || it.name) + "</div>" +
      '<span class="arc-cat">' + esc(cat) + "</span>" +
      '<span class="arc-arrow">▶</span>' +
      '<div class="arc-title">' + esc(m.title || "(未命名)") + "</div>" +
      '<div class="arc-meta">作者: ' + esc(m.author || "佚名") + " · " + esc(m.date || "?") + (tags ? " · " + tags : "") + "</div>" +
      '<div class="arc-body">';
    (m.fields || []).forEach(function (f) {
      if (!f || !f.k) return;
      h += '<div class="arc-fields"><span class="arc-k">' + esc(f.k) + ": </span><span class=\"arc-v\">" + esc(f.v) + "</span></div>";
    });
    if (m.body && m.body.trim()) h += '<div class="md-body">' + mdRender(m.body) + "</div>";
    var slug = window.GLPage.slugOf(m);
    h += '<div><a class="arc-open" href="' + window.GLPage.pageURL(slug) + '">打开独立页面 ▸</a></div>';
    h += "</div>";
    return h;
  }

  function render() {
    var items = state.items.filter(function (it) {
      if (state.tab !== "all" && it.type !== state.tab) return false;
      if (state.cat && it.meta.category !== state.cat) return false;
      if (state.q) {
        var m = it.meta;
        var hay = [m.id, m.title, m.category, m.author, m.date, (m.tags || []).join(" "), (m.fields || []).map(function (f) { return f.k + f.v; }).join(" "), m.body].join(" ").toLowerCase();
        if (hay.indexOf(state.q) < 0) return false;
      }
      return true;
    });

    /* 按日期倒序, 再按文件名 */
    items.sort(function (a, b) {
      var da = a.meta.date || "", db = b.meta.date || "";
      if (da !== db) return da < db ? 1 : -1;
      return a.name < b.name ? -1 : 1;
    });

    var list = $("#arc-list");
    list.innerHTML = "";
    items.forEach(function (it) {
      var el = document.createElement("article");
      el.className = "arc-card mono";
      el.innerHTML = cardHTML(it);
      el.addEventListener("click", function () { el.classList.toggle("open"); });
      list.appendChild(el);
    });

    $("#arc-empty").classList.toggle("hidden", items.length > 0);
    $("#arc-count").textContent = "共 " + state.items.length + " 条 · 显示 " + items.length + " 条";
    renderChips();
  }

  function renderChips() {
    var cats = [];
    state.items.forEach(function (it) {
      var c = it.meta.category || "其他";
      if (cats.indexOf(c) < 0) cats.push(c);
    });
    cats.sort();
    var box = $("#chips");
    box.innerHTML = "";
    box.appendChild(chipEl("", "全部"));
    cats.forEach(function (c) { box.appendChild(chipEl(c, c)); });
  }

  function chipEl(val, label) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip mono" + (state.cat === val ? " active" : "");
    b.textContent = label;
    b.addEventListener("click", function () {
      state.cat = state.cat === val ? "" : val;
      render();
    });
    return b;
  }

  /* ================= 事件 ================= */

  $$(".arc-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      $$(".arc-tab").forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      state.tab = tab.dataset.tab;
      render();
    });
  });

  var searchTimer = 0;
  $("#arc-search").addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.q = this.value.trim().toLowerCase();
      render();
    }.bind(this), 200);
  });

  loadAll();
})();