/* ==========================================================
   GL 层群宇宙 · 通用 Markdown 渲染器（零依赖）
   支持: 标题 / 粗斜体 / 行内代码 / 代码块 / 引用 / 列表 /
        表格 / 链接 / 分隔线 / 段落（自动转义 HTML）
   用法: mdRender(markdownText) -> HTML 字符串
   ========================================================== */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* 行内格式: 链接 / 行内代码 / 加粗 / 斜体 */
  function inline(s) {
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    return s;
  }

  function headingLevel(h) {
    var n = h.length;
    if (n <= 1) return 2;
    if (n === 2) return 3;
    return 4;
  }

  function isTableSep(line) {
    return /^\s*\|?[\s:|-]+\|?\s*$/.test(line);
  }

  function renderTable(rows) {
    var html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
    var header = rows[0].replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|");
    header.forEach(function (c) { html += "<th>" + inline(c.trim()) + "</th>"; });
    html += "</tr></thead><tbody>";
    for (var i = 2; i < rows.length; i++) {
      var cells = rows[i].replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|");
      html += "<tr>";
      cells.forEach(function (c) { html += "<td>" + inline(c.trim()) + "</td>"; });
      html += "</tr>";
    }
    html += "</tbody></table></div>";
    return html;
  }

  function mdRender(md) {
    if (!md) return "";
    var lines = String(md).replace(/\r\n/g, "\n").split("\n");
    var out = [];
    var i = 0;
    var listStack = []; // 栈: "ul" | "ol" | null

    function closeListsTo(depth) {
      while (listStack.length > depth) {
        out.push("</" + listStack.pop() + ">");
      }
    }
    function openList(type) {
      listStack.push(type);
      out.push("<" + type + ">");
    }

    while (i < lines.length) {
      var line = lines[i];

      /* 代码围栏 */
      if (/^\s*```/.test(line)) {
        closeListsTo(0);
        var code = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { code.push(lines[i]); i++; }
        i++; // 跳过结束围栏
        out.push("<pre class=\"md-code\"><code>" + esc(code.join("\n")) + "</code></pre>");
        continue;
      }

      /* 表格 */
      if (/^\s*\|.*\|\s*$/.test(line) && lines[i + 1] && isTableSep(lines[i + 1])) {
        closeListsTo(0);
        var rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
        out.push(renderTable(rows));
        continue;
      }

      /* 标题 */
      var hm = line.match(/^(#{1,6})\s+(.*)$/);
      if (hm) {
        closeListsTo(0);
        var lv = headingLevel(hm[1]);
        out.push("<h" + lv + ">" + inline(hm[2]) + "</h" + lv + ">");
        i++;
        continue;
      }

      /* 分隔线 */
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        closeListsTo(0);
        out.push("<hr>");
        i++;
        continue;
      }

      /* 引用 */
      if (/^\s*>\s?/.test(line)) {
        closeListsTo(0);
        var q = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
        out.push("<blockquote>" + q.map(inline).join("<br>") + "</blockquote>");
        continue;
      }

      /* 无序列表 */
      var um = line.match(/^\s*[-*•]\s+(.*)$/);
      if (um) {
        if (!listStack.length || listStack[listStack.length - 1] !== "ul") openList("ul");
        out.push("<li>" + inline(um[1]) + "</li>");
        i++;
        continue;
      }

      /* 有序列表 */
      var om = line.match(/^\s*(\d+)[.、)]\s+(.*)$/);
      if (om) {
        if (!listStack.length || listStack[listStack.length - 1] !== "ol") openList("ol");
        out.push("<li>" + inline(om[2]) + "</li>");
        i++;
        continue;
      }

      closeListsTo(0);

      /* 空行 */
      if (/^\s*$/.test(line)) { i++; continue; }

      /* 段落 */
      var para = [];
      while (i < lines.length &&
             !/^\s*$/.test(lines[i]) &&
             !/^\s*```/.test(lines[i]) &&
             !/^(#{1,6})\s+/.test(lines[i]) &&
             !/^\s*\|.*\|\s*$/.test(lines[i]) &&
             !/^\s*[-*•]\s+/.test(lines[i]) &&
             !/^\s*(\d+)[.、)]\s+/.test(lines[i]) &&
             !/^\s*>\s?/.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      out.push("<p>" + inline(para.join("<br>")) + "</p>");
    }

    closeListsTo(0);
    return out.join("\n");
  }

  root.mdRender = mdRender;
})(window);