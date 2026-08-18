/* ==========================================================
   R.O.R 终端 · 交互脚本
   开机序列 / 日志打字 / 命令栏 / 滚动监听
   ========================================================== */
(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var params = new URLSearchParams(window.location.search);

  /* ---------- 工具: 打字机 ---------- */
  function typeLines(el, lines, speed, after) {
    if (!el) { if (after) after(); return; }
    el.innerHTML = "";
    var li = 0;
    function nextLine() {
      if (li >= lines.length) { if (after) after(); return; }
      var div = document.createElement("div");
      el.appendChild(div);
      var text = lines[li];
      var i = 0;
      (function tick() {
        if (i <= text.length) {
          div.innerHTML = text.slice(0, i);
          i++;
          setTimeout(tick, speed);
        } else {
          li++;
          setTimeout(nextLine, speed * 6);
        }
      })();
    }
    nextLine();
  }

  /* ---------- 1. 开机序列（「门」） ---------- */
  var doorScreen = $("#door-screen");
  var bootEl = $("#boot-log");

  var BOOT = [
    "R.O.R 中央信息库 · 终端 v2.1.0",
    "(c) Return of Religion — 归来教",
    "",
    "> 自检业力模块 .......... <span class=\"ok\">[ OK ]</span>",
    "> 挂载 /gl/archive ...... <span class=\"warn\">[ 87.3% ]</span>",
    "> 校验「门」状态 ........ <span class=\"warn\">[ 虚掩 ]</span>",
    "> 权限 .................. <span class=\"ok\">[ guest · 只读 ]</span>",
    "",
    "<span class=\"warn\">[!] 非授权人员访问将被记录</span>",
    "",
    "<span class=\"ready\">> 按 [回车] 或点击任意处 推开「门」_</span>"
  ];

  var bootDone = false;
  function startBoot() {
    bootDone = true;
    typeLines(bootEl, BOOT, 16, function () {});
  }

  function openDoor() {
    if (!doorScreen) return;
    doorScreen.classList.add("hidden");
    document.body.style.overflow = "";
    setTimeout(typeHeroLog, 420);
  }

  if (doorScreen) {
    if (params.get("enter") === "1") {
      // 直链/截图模式: 直接进入
      doorScreen.style.display = "none";
      document.body.style.overflow = "";
      setTimeout(typeHeroLog, 150);
    } else {
      document.body.style.overflow = "hidden";
      startBoot();
      var openOnce = function () { if (!bootDone || doorScreen.classList.contains("hidden")) return; openDoor(); };
      doorScreen.addEventListener("click", openOnce);
      document.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && doorScreen && !doorScreen.classList.contains("hidden")) openDoor();
      });
    }
  }

  /* ---------- 2. 概览日志 ---------- */
  var logEl = $("#hero-log");
  var logTyped = false;
  var HERO_LOG = [
    "guest@ror:~$ ./archive --open gl_universe",
    "> 载入档案: GL 层群宇宙设定 ............ OK",
    "> 数据库复原度: 87.3% · 门状态: 虚掩",
    "> 欢迎, 迷途者。"
  ];
  function typeHeroLog() {
    if (logTyped || !logEl) return;
    logTyped = true;
    typeLines(logEl, HERO_LOG, 14, function () {});
  }

  /* ---------- 3. 显现 ---------- */
  var revealEls = $$(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("visible");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.05 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  }

  /* ---------- 4. 进度条 + 返回顶部 + 导航高亮 ---------- */
  var bar = $("#progress-bar");
  var toTop = $("#to-top");
  var navLinks = $$(".nav-link");
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
    if (toTop) toTop.classList.toggle("show", y > 500);

    var current = sections[0];
    var mark = Math.max(0, y + window.innerHeight * 0.35);
    sections.forEach(function (sec) {
      if (sec && sec.offsetTop <= mark) current = sec;
    });
    navLinks.forEach(function (a) {
      a.classList.toggle("active", current && a.getAttribute("href") === "#" + current.id);
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo(0, 0);
    });
  }

  /* ---------- 5. 锚点跳转（瞬时） ---------- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.pageYOffset - 8;
      window.scrollTo(0, top);
      closeNav();
    });
  });

  /* ---------- 6. 移动端菜单 ---------- */
  var toggle = $("#nav-toggle");
  var mask = $("#mask");
  function closeNav() { document.body.classList.remove("nav-open"); }
  if (toggle) toggle.addEventListener("click", function () {
    document.body.classList.toggle("nav-open");
  });
  if (mask) mask.addEventListener("click", closeNav);

  /* ---------- 7. 底部命令栏 ---------- */
  var cmdInput = $("#cmdinput");
  var cmdLog = $("#cmdlog");
  var cmdTimer = null;

  var SECTIONS = ["hero", "ror", "gl-door", "karma", "history", "tech", "shuijing", "relations", "theology", "glossary"];
  var HELP = [
    "可用命令:",
    "  ls            列出档案目录",
    "  1-9           跳转章节 (1=组织档案 ... 9=术语速查)",
    "  0             返回概览",
    "  whoami        显示当前身份",
    "  cat &lt;编号&gt;     打开指定档案 (如: cat 3)",
    "  clear         清屏(试试看)",
    "  exit          退出(试试看)"
  ];

  function echo(lines) {
    if (!cmdLog) return;
    cmdLog.innerHTML = lines.map(function (l) { return "&gt; " + l; }).join("<br>");
    cmdLog.classList.add("show");
    clearTimeout(cmdTimer);
    cmdTimer = setTimeout(function () { cmdLog.classList.remove("show"); }, 5000);
  }

  function runCmd(raw) {
    var cmd = raw.trim().toLowerCase();
    var out;
    if (cmd === "") return;
    else if (/^\d+$/.test(cmd)) {
      var n = parseInt(cmd, 10);
      if (n >= 0 && n <= 9) {
        var target = document.getElementById(SECTIONS[n]);
        if (target) window.scrollTo(0, target.getBoundingClientRect().top + window.pageYOffset - 8);
        out = ["已打开 档案/" + (n === 0 ? "00_概览" : String(n).padStart(2, "0") + "_...") + " [" + n + "]"];
      } else out = ["档案编号超出范围: " + n + " (0-9)"];
    }
    else if (cmd === "ls") out = ["01 组织档案  02 层群与门  03 业体系  04 历史沿革  05 科技档案  06 静水  07 对外关系  08 计算神学  09 术语速查"];
    else if (cmd === "whoami") out = ["guest · 访客级 · 只读权限 · 访问已被记录"];
    else if (cmd === "clear") out = ["档案只读, 无法清屏。", "(权限不足: guest)"];
    else if (cmd === "exit") out = ["门尚未关闭, 无法退出。", "数据复原之日, 门将再次关闭。"];
    else if (cmd === "help") out = HELP;
    else if (cmd.indexOf("cat ") === 0) {
      var num = cmd.slice(4).trim();
      if (/^\d+$/.test(num) && parseInt(num, 10) >= 1 && parseInt(num, 10) <= 9) {
        var t = document.getElementById(SECTIONS[parseInt(num, 10)]);
        if (t) window.scrollTo(0, t.getBoundingClientRect().top + window.pageYOffset - 8);
        out = ["cat: 档案 " + num + " 已打开 (只读)"];
      } else out = ["cat: 档案不存在: " + num];
    }
    else out = ["command not found: " + raw.trim(), "输入 help 查看可用命令"];
    echo(out);
  }

  if (cmdInput) {
    cmdInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        runCmd(cmdInput.value);
        cmdInput.value = "";
      }
    });
  }
})();
