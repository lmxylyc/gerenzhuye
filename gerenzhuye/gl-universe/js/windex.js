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
  if (params.get("repo")) REPO = params.get("repo");
  if (params.get("path")) CONTENT_PATH = params.get("path");

  function esc(s) { return window.GLPage.esc(s); }
  function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }

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
      rel = "../content/" + path.slice(CONTENT_PATH.length + 1);
    }
    if (rel) {
      return fetch(rel, { cache: "no-store" }).then(function (r) {
        if (r.ok) return r.text();
        throw new Error("HTTP " + r.status);
      }).catch(function () {
        return fetch("https://raw.githubusercontent.com/" + REPO + "/HEAD/" + encPath(path), { cache: "no-store" })
          .then(function (r2) {
            return r2.ok ? r2.text() : "";
          });
      });
    }
    return fetch("https://raw.githubusercontent.com/" + REPO + "/HEAD/" + encPath(path), { cache: "no-store" })
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