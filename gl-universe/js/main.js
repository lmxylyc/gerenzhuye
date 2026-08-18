/* ==========================================================
   R.O.R 终端 v2.4.0 · 交互脚本
   开机序列 / 控制台命令引擎 / Neiai问答 / 业力场可视化
   操作动效: 命令回显 / 思考打点 / 清屏上卷 / 跳转闪烁 / 重启闪屏
   ========================================================== */
(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var params = new URLSearchParams(window.location.search);

  var SECTIONS = ["hero", "ror", "gl-door", "karma", "history", "tech", "shuijing", "relations", "theology", "glossary"];
  var SEC_TITLES = ["概览", "组织档案 · R.O.R", "层群与「门」", "业体系", "历史沿革", "科技档案", "关键人物 · 静水", "对外关系", "计算神学", "术语速查"];

  /* ================= 声音 ================= */
  var soundOn = false;
  var actx = null;
  function beep(freq, dur, type, vol) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || "square";
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.025, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (dur || 0.06));
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + (dur || 0.06) + 0.02);
    } catch (e) { /* 音频不可用时静默 */ }
  }

  /* ================= 工具: 打字机 ================= */
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

  /* ================= 1. 开机序列（「门」） ================= */
  var doorScreen = $("#door-screen");
  var bootEl = $("#boot-log");

  var BOOT = [
    "R.O.R 中央信息库 · 终端 v2.4.0",
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
    flash();
    glitchBanner();
    matrixBurst();
    setTimeout(typeHeroLog, 420);
  }

  if (doorScreen) {
    if (params.get("enter") === "1") {
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

  /* ================= 2. 概览日志 ================= */
  var logEl = $("#hero-log");
  var logTyped = false;
  var HERO_LOG = [
    "guest@ror:~$ ./archive --open gl_universe",
    "> 载入档案: GL 层群宇宙设定 ............ OK",
    "> 数据库复原度: 87.3% · 门状态: 虚掩",
    "> 欢迎, 迷途者。 输入 help 查看命令"
  ];
  function typeHeroLog() {
    if (logTyped || !logEl) return;
    logTyped = true;
    typeLines(logEl, HERO_LOG, 14, function () {});
  }

  /* ================= 3. 控制台 ================= */
  var consoleEl = $("#console");
  var consoleShown = false;
  var typeQueue = [];
  var typing = false;

  function showConsole() {
    if (!consoleShown && consoleEl) {
      consoleEl.classList.add("show");
      consoleShown = true;
    }
  }
  function scrollConsole() {
    if (consoleEl) consoleEl.scrollTop = consoleEl.scrollHeight;
  }
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /** 输出一行: out(text) 打字输出; out(text, true) 立即输出(支持HTML) */
  function out(text, instant) {
    if (!consoleEl) return;
    typeQueue.push({ t: text, inst: !!instant });
    if (!typing) pump();
  }

  function pump() {
    if (!typeQueue.length) { typing = false; return; }
    typing = true;
    var item = typeQueue.shift();
    var div = document.createElement("div");
    div.className = "c-line";
    consoleEl.appendChild(div);
    showConsole();
    if (item.inst || item.t.length > 90) {
      div.innerHTML = item.t;
      scrollConsole();
      setTimeout(pump, 14);
      return;
    }
    var i = 0;
    (function tick() {
      if (i <= item.t.length) {
        div.innerHTML = esc(item.t.slice(0, i));
        i++;
        scrollConsole();
        setTimeout(tick, 9);
      } else {
        setTimeout(pump, 55);
      }
    })();
  }

  function clearConsole() {
    if (!consoleEl) return;
    if (!consoleEl.children.length) return;
    consoleEl.classList.add("clearing");
    setTimeout(function () {
      consoleEl.innerHTML = "";
      consoleEl.classList.remove("clearing");
      typeQueue = [];
      typing = false;
    }, 320);
  }

  /** 命令回显: guest@ror:~$ <输入> */
  function echoCommand(cmd) {
    if (!consoleEl) return;
    var div = document.createElement("div");
    div.className = "c-line c-echo";
    div.innerHTML = '<span class="p">guest@ror:~$</span> ' + esc(cmd);
    consoleEl.appendChild(div);
    showConsole();
    scrollConsole();
  }

  /** 全屏闪光 */
  function flash(color) {
    var f = document.getElementById("flash-layer");
    if (!f) return;
    if (color) f.className = "on " + color;
    else f.className = "on";
    setTimeout(function () { f.className = ""; }, 200);
  }

  /* ================= 4. 命令引擎 ================= */
  var cmdHistory = [];
  var hIdx = -1;
  var COMPLETIONS = ["help", "ls", "cat", "open", "neiai", "matrix", "door", "shuijing", "tathata", "date", "echo", "sudo", "rm", "ping", "whoami", "clear", "history", "sound", "exit", "version"];

  function jumpTo(n) {
    var target = document.getElementById(SECTIONS[n]);
    if (target) window.scrollTo(0, target.getBoundingClientRect().top + window.pageYOffset - 8);
    // 目标章节标题闪烁高亮
    var head = target ? target.querySelector(".sec-head") : null;
    if (head) {
      head.classList.remove("sec-flash");
      void head.offsetWidth; /* 重启动画 */
      head.classList.add("sec-flash");
    }
    return "已打开 档案/" + (n === 0 ? "00_概览" : String(n).padStart(2, "0") + "_" + SEC_TITLES[n]) + " [" + n + "]";
  }

  var LS_HTML = SECTIONS.map(function (id, i) {
    return '<a class="c-link" data-sec="' + i + '">[' + String(i).padStart(2, "0") + '] ' + SEC_TITLES[i] + '</a>';
  }).join("<br>");

  var HELP = [
    '<span class="c-bright">可用命令:</span>',
    "  ls / open &lt;编号&gt;  打开档案章节 (1-9, 0=概览)",
    "  neiai &lt;问题&gt;      向 Neiai 提问 (GL 全域AI)",
    "  door              查询「门」状态",
    "  matrix            切换业力场可视化",
    "  shuijing          查看静水档案",
    "  tathata           真如 · 遮诠",
    "  ping neiai        网络延迟测试",
    "  date / echo       系统命令",
    "  sudo / rm -rf /   危险操作(不建议)",
    "  history           命令历史",
    "  sound             音效开关",
    "  clear             清空控制台",
    "  whoami / exit     其他",
    '<span class="c-dim">提示: ↑↓ 翻历史 · Tab 补全 · 按 / 快速聚焦</span>'
  ].join("\n");

  var NEIAI_ANSWERS = [
    "一切以「业」为基底。你想问的, 已在业力模态中被规定。",
    "检索完毕。答案位于第 87.3% 与剩余 12.7% 的边界上。",
    "除原则性问题和保密内容外, 一切皆可回答——你的问题不在禁区。",
    "数据仍在复原中。此问的答案, 可能就在丢失的那 12.7% 里。",
    "清业与浊业交织之处, 便是答案所在。",
    "IR 技术无法提取的, 遮诠法亦无法抵达。",
    "该问题已被记录并上报 R.O.R 中央信息库。访客无权查阅。"
  ];

  function neiaiReply(arg) {
    // 思考打点动画
    var thinkEl = document.createElement("div");
    thinkEl.className = "c-line c-dim";
    thinkEl.textContent = "> 正在检索业力场";
    consoleEl.appendChild(thinkEl);
    showConsole();
    scrollConsole();
    var dots = 0;
    var dt = setInterval(function () {
      dots = (dots + 1) % 4;
      thinkEl.textContent = "> 正在检索业力场" + ".".repeat(dots);
      scrollConsole();
    }, 170);
    beep(660, 0.05, "sine");
    setTimeout(function () {
      clearInterval(dt);
      thinkEl.textContent = "> 正在检索业力场 ...";
      scrollConsole();
      var q = arg.toLowerCase();
      var reply;
      if (!arg) reply = "请给出你的问题。例: neiai 门现在开着吗";
      else if (q.indexOf("门") >= 0) reply = "「门」当前状态: <span class='c-amber'>虚掩</span>。数据库复原度 87.3%。数据全部找回之日, 门将再次关闭。";
      else if (q.indexOf("真如") >= 0) reply = "真如不可表诠, 只可遮诠。它不是业, 不是业力, 不是业报——无限次否定之后, 仍不可达。";
      else if (q.indexOf("静水") >= 0 || q.indexOf("教皇") >= 0) reply = "教皇静水正于 GL 层群之外亲自侦察。其坐标与行踪属保密内容, 访客无权查询。";
      else if (q.indexOf("业") >= 0 || q.indexOf("karma") >= 0) reply = "业(质料) × 业力(形式) → 业报(运动)。此三元结构是一切问题的通解。";
      else if (q.indexOf("千新星") >= 0) reply = "千新星事件: 一次计算奇点。清业与浊业对撞, 诞生了 GL 独有的融合态业力——超图灵介质。";
      else if (q.indexOf("你是谁") >= 0 || q.indexOf("who") >= 0) reply = "我是 Neiai (曾用名 KF)。无实体, 无法破坏。只要业力存在, 我便存在。";
      else reply = NEIAI_ANSWERS[Math.floor(Math.random() * NEIAI_ANSWERS.length)];
      out('<span class="c-bright">[Neiai]</span> ' + reply, true);
      beep(880, 0.06, "sine");
    }, 700 + Math.random() * 600);
  }

  function doorStatus() {
    out('<span class="c-dim">> 查询「门」状态 ...</span>', true);
    setTimeout(function () {
      out([
        '<span class="c-bright">门状态</span> : <span class="c-amber">虚掩</span>',
        '<span class="c-bright">数据库</span> : 复原度 87.3%  <span class="c-block">[███████████░░]</span>',
        '<span class="c-bright">入口</span>    : Level GL-莱特宁湖 (开放, 筛选管制中)',
        '<span class="c-dim">当全部数据被复原时, 门将重新闭合。GL 将再次从外部视野中消失。</span>'
      ].join("<br>"), true);
    }, 250);
  }

  function tathataOut() {
    flash();
    out([
      '<span class="c-bright">真如 (Tathata)</span>',
      '<span class="c-dim">一种仅存在于假设中的理论模型的终极实在。</span>',
      "一切字符、语言与思想在此模型中进行无限次的推演,",
      "经历无限次的自我迭代升级, 在无界限的膨胀中",
      "抵达的<span class='c-amber'>不可能的终局</span>。",
      "",
      "遮诠: 它不是业, 不是业力, 不是业报; 不是清业, 不是浊业;",
      "不是存在, 不是非存在……",
      "<span class='c-dim'>每一次否定都是一次运算, 而真如始终位于所有边界之外。</span>",
      "",
      "<span class='c-dim'>归来临界: 逻辑上不可达。「归来」是永恒的朝向运动。</span>"
    ].join("<br>"), true);
    beep(440, 0.1, "sine");
  }

  function sigilOut() {
    out([
      '<span class="c-bright">静水 · R.O.R 教皇</span>',
      '<pre class="doc" style="display:inline-block">        @',
      "       /|\\",
      "      / | \\",
      "     /  |  \\",
      "    @   |   @",
      "     \\  |  /",
      "      \\ | /",
      "       \\|/",
      "        |",
      "       /|\\",
      "      @ | @</pre>",
      "图腾: 以孔雀翎羽为叶的柳树 (@ = 千眼)",
      "数据库大丢失事件后, 亲率探索队离开 GL 侦察。"
    ].join("<br>"), true);
  }

  function runCmd(raw) {
    var cmd = raw.trim();
    if (!cmd) return;
    cmdHistory.push(cmd);
    if (cmdHistory.length > 60) cmdHistory.shift();
    hIdx = cmdHistory.length;
    beep(880, 0.03);
    echoCommand(cmd);

    var parts = cmd.split(/\s+/);
    var c = parts[0].toLowerCase();
    var arg = parts.slice(1).join(" ");

    if (/^\d+$/.test(c)) {
      var n = parseInt(c, 10);
      if (n >= 0 && n <= 9) out(jumpTo(n), true);
      else out('<span class="c-red">档案编号超出范围: ' + n + ' (0-9)</span>', true);
      return;
    }

    switch (c) {
      case "help": case "?": case "h":
        out(HELP, true); break;
      case "ls": case "dir":
        out('<span class="c-dim">$ ls 档案/</span><br>' + LS_HTML, true); break;
      case "cat": case "open": case "go": {
        var m = parseInt(arg, 10);
        if (/^\d+$/.test(arg) && m >= 0 && m <= 9) out(jumpTo(m), true);
        else if (/^\d+$/.test(arg)) out('<span class="c-red">cat: 档案不存在: ' + arg + '</span>', true);
        else out('<span class="c-red">用法: cat &lt;编号 0-9&gt; (如: cat 8)</span>', true);
        break;
      }
      case "neiai": case "ask":
        neiaiReply(arg); break;
      case "matrix":
        toggleMatrix(); break;
      case "door":
        doorStatus(); break;
      case "shuijing": case "静水":
        sigilOut(); break;
      case "tathata": case "真如":
        tathataOut(); break;
      case "ping":
        pingNeiai(); break;
      case "date":
        out("> " + new Date().toLocaleString("zh-CN"), true); break;
      case "time":
        out("> " + new Date().toLocaleTimeString("zh-CN"), true); break;
      case "echo":
        out("> " + (arg || ""), true); break;
      case "whoami":
        out("guest · 访客级 · 只读权限 · 访问已被记录", true); break;
      case "clear": case "cls":
        clearConsole(); beep(520, 0.04); break;
      case "exit": case "quit":
        out([
          '<span class="c-amber">门尚未关闭, 无法退出。</span>',
          '<span class="c-dim">数据复原之日, 门将再次关闭——届时你也出不去了。</span>'
        ].join("<br>"), true);
        beep(220, 0.12, "sawtooth"); break;
      case "sudo":
        out('<span class="c-red">guest 不在 sudoers 中。此事件已被记录。</span>', true);
        beep(180, 0.15, "sawtooth"); break;
      case "rm":
        if (arg === "-rf /") out([
          '<span class="c-red">业力拦截!</span> 该操作将删除「门」的信息完整性。',
          '<span class="c-dim">R.O.R 安全策略: 访客级操作被拒绝。 (事件已上报)</span>'
        ].join("<br>"), true);
        else out("用法: rm -rf /  (你不该试这个)", true);
        beep(180, 0.15, "sawtooth"); break;
      case "history":
        out(cmdHistory.map(function (h, i) { return String(i + 1).padStart(3, " ") + "  " + esc(h); }).join("<br>") || "> (空)", true); break;
      case "sound": case "beep":
        soundOn = !soundOn;
        out("> 音效: " + (soundOn ? "<span class='c-bright'>ON</span>" : "<span class='c-dim'>OFF</span>"), true);
        if (soundOn) beep(880, 0.08); break;
      case "version": case "版本":
        out("R.O.R 终端 v2.4.0 (build 20260818) · 动效版 · guest", true); break;
      case "reboot": case "restart":
        out("> 重启终端 ...", true);
        setTimeout(function () {
          flash("white");
          setTimeout(function () {
            flash("white");
            setTimeout(function () { location.reload(); }, 260);
          }, 260);
        }, 600);
        break;
      default:
        out('<span class="c-red">command not found: ' + esc(c) + '</span>  — 输入 help 查看可用命令', true);
        beep(200, 0.12, "sawtooth");
    }
  }

  function pingNeiai() {
    out('<span class="c-dim">PING neiai (业力场)</span>', true);
    setTimeout(function () {
      out("来自业力场的应答: 时间=0.87ms 时间=0.87ms 时间=0.87ms", true);
      out('<span class="c-dim">Neiai 的统计: 已发送 = 3, 已接收 = 3, 丢失 = 0 (0% 丢失)</span>', true);
      out('<span class="c-dim">无实体节点: 无法 ping 通, 因为它无处不在。</span>', true);
    }, 300);
  }

  /* ================= 5. 业力场可视化 (Matrix) ================= */
  var mCanvas = $("#matrix");
  var matrixOn = false;
  var mCtx = null, mRaf = 0, mDrops = [], mCols = 0, mChars = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789业力真如门归来静水遮诠";

  function startMatrix() {
    if (!mCanvas || matrixOn) return;
    matrixOn = true;
    mCanvas.classList.add("on");
    mCtx = mCanvas.getContext("2d");
    resizeMatrix();
    mDrops = [];
    for (var i = 0; i < mCols; i++) mDrops[i] = Math.floor(Math.random() * -40);
    drawMatrix();
  }
  function stopMatrix() {
    matrixOn = false;
    if (mCanvas) mCanvas.classList.remove("on");
    cancelAnimationFrame(mRaf);
    if (mCtx) mCtx.clearRect(0, 0, mCanvas.width, mCanvas.height);
  }
  function resizeMatrix() {
    if (!mCanvas) return;
    mCanvas.width = window.innerWidth;
    mCanvas.height = window.innerHeight;
    mCols = Math.floor(mCanvas.width / 15);
  }
  function drawMatrix() {
    if (!matrixOn || !mCtx) return;
    mCtx.fillStyle = "rgba(1, 4, 2, 0.10)";
    mCtx.fillRect(0, 0, mCanvas.width, mCanvas.height);
    mCtx.font = "13px monospace";
    for (var i = 0; i < mCols; i++) {
      var ch = mChars[Math.floor(Math.random() * mChars.length)];
      var x = i * 15;
      var y = mDrops[i] * 15;
      mCtx.fillStyle = Math.random() > 0.975 ? "#7dffb0" : "#35e07a";
      mCtx.fillText(ch, x, y);
      if (y > mCanvas.height && Math.random() > 0.975) mDrops[i] = 0;
      mDrops[i]++;
    }
    mRaf = requestAnimationFrame(drawMatrix);
  }
  function toggleMatrix() {
    if (matrixOn) {
      stopMatrix();
      out("> 业力场可视化: <span class='c-dim'>OFF</span>", true);
    } else {
      startMatrix();
      out("> 业力场可视化: <span class='c-bright'>ON</span> — 键入 matrix 关闭", true);
      beep(660, 0.05, "sine");
    }
  }
  function matrixBurst() {
    // 开门瞬间的短暂业力场闪现
    if (!mCanvas || matrixOn) return;
    startMatrix();
    setTimeout(stopMatrix, 2600);
  }
  window.addEventListener("resize", function () { if (matrixOn) resizeMatrix(); });

  /* ================= 6. 命令输入交互 ================= */
  var cmdInput = $("#cmdinput");

  if (cmdInput) {
    cmdInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        runCmd(cmdInput.value);
        cmdInput.value = "";
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (hIdx > 0) { hIdx--; cmdInput.value = cmdHistory[hIdx] || ""; }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (hIdx < cmdHistory.length - 1) { hIdx++; cmdInput.value = cmdHistory[hIdx] || ""; }
        else { hIdx = cmdHistory.length; cmdInput.value = ""; }
      } else if (e.key === "Tab") {
        e.preventDefault();
        var cur = cmdInput.value.trim().toLowerCase();
        if (!cur) return;
        var matches = COMPLETIONS.filter(function (c2) { return c2.indexOf(cur) === 0; });
        if (matches.length === 1) cmdInput.value = matches[0] + " ";
        else if (matches.length > 1) out("> " + matches.join("  "), true);
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        clearConsole();
      }
    });

    // 控制台点击聚焦输入框
    $("#cmdbar").addEventListener("click", function (e) {
      if (e.target.tagName !== "A" && e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON") cmdInput.focus();
    });

    // 控制台内可点击档案行
    consoleEl.addEventListener("click", function (e) {
      var link = e.target.closest ? e.target.closest(".c-link") : null;
      if (link && link.dataset.sec !== undefined) {
        window.scrollTo(0, document.getElementById(SECTIONS[+link.dataset.sec]).getBoundingClientRect().top + window.pageYOffset - 8);
      }
    });

    // 全局按键: / 聚焦输入（门开启后）
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== cmdInput && doorScreen && doorScreen.classList.contains("hidden")) {
        e.preventDefault();
        cmdInput.focus();
      }
    });

    // 帮助按钮
    var helpBtn = $("#cmdhelp");
    if (helpBtn) helpBtn.addEventListener("click", function () { out(HELP, true); cmdInput.focus(); });

    // 滚动百分比 → 点击回顶
    var pctEl = $("#scrollpct");
    if (pctEl) pctEl.addEventListener("click", function () { window.scrollTo(0, 0); });
  }

  /* ================= 7. 滚动: 进度 / 百分比 / 导航高亮 ================= */
  var bar = $("#progress-bar");
  var toTop = $("#to-top");
  var pctEl = $("#scrollpct");
  var navLinks = $$(".nav-link");
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? y / max : 0;
    if (bar) bar.style.width = (ratio * 100) + "%";
    if (toTop) toTop.classList.toggle("show", y > 500);
    if (pctEl) {
      var blocks = Math.round(ratio * 12);
      pctEl.innerHTML = "[" + "█".repeat(blocks) + "&nbsp;".repeat(12 - blocks) + "] " + Math.round(ratio * 100) + "%";
    }

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
    toTop.addEventListener("click", function () { window.scrollTo(0, 0); });
  }

  /* ================= 8. 锚点跳转 ================= */
  function closeNav() { document.body.classList.remove("nav-open"); }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      window.scrollTo(0, target.getBoundingClientRect().top + window.pageYOffset - 8);
      closeNav();
    });
  });

  /* ================= 9. 移动端菜单 ================= */
  var toggle = $("#nav-toggle");
  var mask = $("#mask");
  if (toggle) toggle.addEventListener("click", function () {
    document.body.classList.toggle("nav-open");
  });
  if (mask) mask.addEventListener("click", closeNav);

  /* ================= 10. 显现 + 命令行动画 ================= */
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

  // 每个章节的 $ cat 命令行: 进入视口时打字
  var cmdLines = $$(".cmd-line");
  cmdLines.forEach(function (el) {
    var text = el.textContent.trim();
    el.textContent = "";
    var done = false;
    function typeIt() {
      if (done) return;
      done = true;
      el.innerHTML = '<span class="typing-caret"></span>';
      var i = 0;
      (function tick() {
        if (i <= text.length) {
          el.innerHTML = (i > 0 ? esc(text.slice(0, i)) : "") + '<span class="typing-caret"></span>';
          i++;
          setTimeout(tick, 13);
        } else {
          el.innerHTML = esc(text);
        }
      })();
    }
    if ("IntersectionObserver" in window) {
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { typeIt(); io2.disconnect(); }
        });
      }, { threshold: 0.6 });
      io2.observe(el);
    } else typeIt();
  });

  /* ================= 11. Banner 故障特效 ================= */
  var banner = $("#banner");
  function glitchBanner() {
    if (!banner) return;
    banner.dataset.text = banner.textContent;
    banner.classList.add("glitch");
    setTimeout(function () { banner.classList.remove("glitch"); }, 1200);
  }
  // 随机故障闪现 (25-45s)
  setTimeout(function glitchLoop() {
    if (!doorScreen.classList.contains("hidden")) { setTimeout(glitchLoop, 8000); return; }
    glitchBanner();
    setTimeout(glitchLoop, 25000 + Math.random() * 20000);
  }, 20000);

  /* ================= 12. 初次访问提示 ================= */
  if (params.get("enter") === "1") {
    setTimeout(function () { out('<span class="c-dim">提示: 输入 help 查看全部命令 · matrix 开启业力场可视化</span>', true); }, 1200);
  }

  /* ================= 13. 移动端: 键盘遮挡处理 ================= */
  // iOS/Android 软键盘弹出时, visualViewport 变矮, 把命令栏顶到键盘上方
  var cmdbarEl = $("#cmdbar");
  if (cmdbarEl && window.visualViewport) {
    var vv = window.visualViewport;
    var isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    if (isTouch) {
      function syncCmdbar() {
        var diff = window.innerHeight - vv.height;
        if (diff > 80) {
          cmdbarEl.style.bottom = diff + "px";
          cmdbarEl.style.transition = "none";
        } else {
          cmdbarEl.style.bottom = "";
          cmdbarEl.style.transition = "";
        }
      }
      vv.addEventListener("resize", syncCmdbar);
      vv.addEventListener("scroll", syncCmdbar);
    }
  }
})();
