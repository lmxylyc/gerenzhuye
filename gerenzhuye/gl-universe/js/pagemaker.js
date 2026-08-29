/* ==========================================================
   GL 层群宇宙 · 页面生成器
   每个创作页面对应一个独立子网址: w/<slug>.html
   编辑保存时调用 buildPageHTML 生成完整静态页面
   ========================================================== */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* 文件名安全化 */
  function sanitize(name) {
    return String(name || "").replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }

  /* 页面 slug: 优先标题, 其次编号 */
  function slugOf(meta) {
    var s = sanitize(meta && meta.title);
    if (s) return s;
    s = sanitize(meta && meta.id);
    return s || "untitled";
  }

  function pageURL(slug) {
    return "w/" + encodeURIComponent(slug) + ".html";
  }

  /* 字段区 HTML */
  function fieldsHTML(fields) {
    if (!fields || !fields.length) return "";
    var h = '<div class="p-fields">';
    fields.forEach(function (f) {
      if (!f || !f.k) return;
      h += '<div class="p-field"><span class="p-k">' + esc(f.k) + ": </span><span class=\"p-v\">" + esc(f.v) + "</span></div>";
    });
    h += "</div>";
    return h;
  }

  /* 完整独立页面 */
  function buildPageHTML(meta, bodyHtml, opts) {
    opts = opts || {};
    var title = (meta && meta.title) || "(未命名)";
    var id = (meta && meta.id) || "";
    var cat = (meta && meta.category) || "其他";
    var author = (meta && meta.author) || "佚名";
    var date = (meta && meta.date) || "";
    var tags = (meta && meta.tags || []).map(function (t) { return "#" + esc(t); }).join(" ");
    var slug = slugOf(meta);
    var desc = String(bodyHtml || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    var siteName = opts.siteName || "GL 层群宇宙";

    return '<!DOCTYPE html>\n' +
      '<html lang="zh-CN">\n' +
      '<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n' +
      '<meta name="theme-color" content="#010402">\n' +
      '<meta name="description" content="' + esc(desc) + '">\n' +
      '<meta property="og:title" content="' + esc(title) + ' · ' + esc(siteName) + '">\n' +
      '<meta property="og:description" content="' + esc(desc) + '">\n' +
      '<meta property="og:type" content="article">\n' +
      '<title>' + esc(title) + " · " + esc(siteName) + "</title>\n" +
      '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E%3Crect width=\'32\' height=\'32\' fill=\'%23010402\'/%3E%3Ctext x=\'16\' y=\'23\' font-size=\'18\' text-anchor=\'middle\' fill=\'%2335e07a\' font-family=\'monospace\'%3E%3E_%3C/text%3E%3C/svg%3E">\n' +
      '<link rel="stylesheet" href="../css/style.css">\n' +
      '<style>\n' +
      /* ---- 页面专属样式 ---- */
      ".p-top{position:fixed;top:0;left:0;right:0;height:48px;z-index:2400;background:#000;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:.8rem;padding:0 .9rem;font-size:13px;}\n" +
      ".p-top a{color:var(--fg-bright);text-decoration:none;white-space:nowrap;}\n" +
      ".p-top .dim{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;}\n" +
      ".p-main{max-width:760px;margin:0 auto;padding:64px 14px 24px;}\n" +
      ".p-id{font-size:12px;color:var(--amber);border:1px solid var(--line);border-radius:4px;padding:1px 8px;}\n" +
      ".p-cat{font-size:12px;color:var(--bg);background:var(--fg);border-radius:4px;padding:1px 8px;margin-left:6px;}\n" +
      ".p-title{font-size:22px;color:var(--fg-bright);margin:10px 0 6px;line-height:1.4;}\n" +
      ".p-meta{font-size:12px;color:var(--fg-dim);margin-bottom:16px;word-break:break-all;}\n" +
      ".p-fields{margin-bottom:14px;}\n" +
      ".p-field{padding:4px 0;border-bottom:1px dotted var(--line-dim);word-break:break-word;}\n" +
      ".p-k{color:var(--fg-dim);}\n" +
      ".p-v{white-space:pre-wrap;}\n" +
      ".p-body{font-size:14.5px;word-break:break-word;}\n" +
      ".p-body h2,.p-body h3,.p-body h4{color:var(--fg-bright);margin:1em 0 .4em;line-height:1.4;}\n" +
      ".p-body h2{font-size:19px;border-bottom:1px solid var(--line-dim);padding-bottom:6px;}\n" +
      ".p-body h3{font-size:17px;}\n" +
      ".p-body h4{font-size:15px;}\n" +
      ".p-body p{margin:.5em 0;}\n" +
      ".p-body strong{color:var(--fg-bright);}\n" +
      ".p-body em{color:var(--amber);font-style:normal;}\n" +
      ".p-body code{background:var(--bg-2);border:1px solid var(--line-dim);border-radius:4px;padding:1px 5px;font-size:13px;color:var(--amber);}\n" +
      ".p-body pre.md-code{background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:12px;overflow-x:auto;margin:.6em 0;}\n" +
      ".p-body pre.md-code code{border:none;background:none;padding:0;color:var(--fg);}\n" +
      ".p-body blockquote{border-left:3px solid var(--fg-dim);padding:4px 12px;margin:.6em 0;color:var(--fg-dim);}\n" +
      ".p-body ul,.p-body ol{margin:.5em 0 .5em 1.4em;}\n" +
      ".p-body li{margin:.2em 0;}\n" +
      ".p-body hr{border:none;border-top:1px dashed var(--line);margin:1em 0;}\n" +
      ".p-body a{color:var(--fg-bright);text-decoration:underline;}\n" +
      ".p-body img{max-width:100%;border-radius:8px;}\n" +
      ".md-table-wrap{overflow-x:auto;margin:.6em 0;}\n" +
      ".md-table{border-collapse:collapse;font-size:13px;min-width:100%;}\n" +
      ".md-table th,.md-table td{border:1px solid var(--line);padding:7px 10px;text-align:left;vertical-align:top;}\n" +
      ".md-table th{background:var(--bg-2);color:var(--fg-bright);white-space:nowrap;}\n" +
      ".p-foot{max-width:760px;margin:0 auto;padding:8px 14px 30px;text-align:center;font-size:12px;color:var(--fg-dim);line-height:2;}\n" +
      ".p-foot a{color:var(--fg-bright);}\n" +
      "</style>\n" +
      "</head>\n" +
      "<body>\n" +
      '<header class="p-top mono">\n' +
      '<a href="../index.html">◄ R.O.R 终端</a>\n' +
      '<span class="dim">' + esc(cat) + "</span>\n" +
      '<a href="../archive.html">档案库</a>\n' +
      '<a href="../editor/index.html?page=' + encodeURIComponent(slug) + '">✎ 编辑</a>\n' +
      "</header>\n" +
      '<main class="p-main">\n' +
      '<div class="p-id mono">' + esc(id || "?") + "</div><span class=\"p-cat mono\">" + esc(cat) + "</span>\n" +
      '<h1 class="p-title mono">' + esc(title) + "</h1>\n" +
      '<div class="p-meta mono">作者: ' + esc(author) + " · " + esc(date) + (tags ? " · " + tags : "") + "</div>\n" +
      '<article class="p-body">\n' +
      fieldsHTML(meta && meta.fields) +
      (bodyHtml || "") +
      "</article>\n" +
      "</main>\n" +
      '<footer class="p-foot mono">\n' +
      '<div>— EOF · ' + esc(siteName) + " 档案库 —</div>\n" +
      '<div><a href="../archive.html">← 返回档案库</a> · <a href="../index.html">R.O.R 终端</a></div>\n' +
      "</footer>\n" +
      "</body>\n" +
      "</html>";
  }

  root.GLPage = {
    esc: esc,
    sanitize: sanitize,
    slugOf: slugOf,
    pageURL: pageURL,
    fieldsHTML: fieldsHTML,
    buildPageHTML: buildPageHTML
  };
})(window);