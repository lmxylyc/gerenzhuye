/* ==========================================================
   w/ 页面索引脚本
   列出 content/ 下所有档案并链接到各自独立页面
   ========================================================== */
(function () {
  "use strict";

  var CFG = (window.GL && window.GL.config) || {};
  var REPO = CFG.repo || "lmxylyc/gerenzhuye";
  var CONTENT_PATH = CFG.contentPath || "gerenzhuye/gl-universe/content";

  var params = new URLSearchParams(window.location.search);

  /* 清洗外部输入(URL 参数/localStorage): 去掉 ASCII 控制字符(换行/回车/制表等),
     Chrome 等内核会对含控制字符的 fetch URL 抛 "Failed to execute 'fetch' on 'Window': Invalid value" */
  function cleanStr(s) {
    return String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  }

  if (params.get("repo")) REPO = cleanStr(params.get("repo"));
  if (params.get("path")) CONTENT_PATH = cleanStr(params.get("path"));

  function esc(s) { return window.GLPage.esc(s); }
  function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }

  /* 安全 fetch: fetch 的 URL 解析与 RequestInit 校验是同步抛错,
     这里统一 try/catch, 并预检 URL(可解析 + 无控制字符), 非法时走 Promise.reject
     而不是让浏览器抛同步 TypeError */
  function safeFetch(url, init) {
    try {
      var u = cleanStr(url);
      if (!u) return Promise.reject(new Error("请求 URL 无效"));
      new URL(u, window.location.href); /* 解析失败会同步抛错 */
      return fetch(u, init);
    } catch (e) {
      try { console.warn("[gl] fetch 已被安全拦截: " + (e && e.message ? e.message : e) + " | " + String(url)); } catch (e2) { /* 忽略 */ }
      return Promise.reject(e);
    }
  }

  function apiContents(dir) {
    if (!REPO || typeof REPO !== "string") {
      return Promise.reject(new Error("仓库配置无效，请检查 config.js 中的 repo 设置"));
    }
    if (!dir || typeof dir !== "string") {
      return Promise.reject(new Error("目录路径无效"));
    }
    return safeFetch("https://api.github.com/repos/" + REPO + "/contents/" + encPath(dir), {
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
    if (!path || typeof path !== "string") {
      return Promise.reject(new Error("文件路径无效"));
    }
    if (!REPO || typeof REPO !== "string") {
      return Promise.reject(new Error("仓库配置无效，请检查 config.js 中的 repo 设置"));
    }
    var rel = "";
    if (CONTENT_PATH && path.indexOf(CONTENT_PATH + "/") === 0) {
      rel = "../content/" + path.slice(CONTENT_PATH.length + 1);
    }
    if (rel) {
      return safeFetch(rel, { cache: "no-store" }).then(function (r) {
        if (r.ok) return r.text();
        throw new Error("HTTP " + r.status);
      }).catch(function () {
        return safeFetch("https://raw.githubusercontent.com/" + REPO + "/HEAD/" + encPath(path), { cache: "no-store" })
          .then(function (r2) {
            return r2.ok ? r2.text() : "";
          });
      });
    }
    return safeFetch("https://raw.githubusercontent.com/" + REPO + "/HEAD/" + encPath(path), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.text() : ""; });
  }

  function parseArchive(text) {
    try {
      var o = JSON.parse(text);
      return { id: o.id || "", title: o.title || "", category: o.category || "", author: o.author || "", date: o.date || "" };
    } catch (e) { return null; }
  }

  function parseFrontMatter(text) {
    var m = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { meta: {} };
    var meta = {};
    m[1].split("\n").forEach(function (line) {
      var i = line.indexOf(":");
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    return { meta: meta };
  }

  var listEl = document.getElementById("ix-list");
  if (!listEl) return;

  var dirs = [CONTENT_PATH + "/archives", CONTENT_PATH + "/docs"];
  Promise.all(dirs.map(apiContents)).then(function (results) {
    var all = [];
    results[0].forEach(function (f) { all.push({ type: "archives", name: f.name, path: f.path }); });
    results[1].forEach(function (f) { all.push({ type: "docs", name: f.name, path: f.path }); });
    if (!all.length) {
      listEl.innerHTML = "暂无页面";
      return;
    }
    return Promise.all(all.map(function (it) {
      return rawContent(it.path).then(function (text) {
        it.meta = it.type === "archives" ? parseArchive(text) : parseFrontMatter(text).meta;
        return it;
      }).catch(function () { it.meta = null; return it; });
    }));
  }).then(function (items) {
    if (!items) return;
    var lis = items.filter(function (it) { return it.meta && (it.meta.title || it.meta.id); })
      .sort(function (a, b) {
        var da = a.meta.date || "", db = b.meta.date || "";
        if (da !== db) return da < db ? 1 : -1;
        return a.name < b.name ? -1 : 1;
      })
      .map(function (it) {
        var slug = window.GLPage.slugOf(it.meta);
        return "<li><a href=\"" + encodeURIComponent(slug) + '.html">' + esc(it.meta.title || it.meta.id) + "</a>" +
          '<span class="ix-meta">' + esc(it.meta.category || "其他") + " · " + esc(it.meta.author || "") + " · " + esc(it.meta.date || "") + "</span></li>";
      })
      .join("");
    listEl.innerHTML = lis ? "<ul>" + lis + "</ul>" : "暂无页面";
  }).catch(function (e) {
    listEl.textContent = "加载失败: " + (e && e.message ? e.message : e);
  });
})();