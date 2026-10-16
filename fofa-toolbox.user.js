// ==UserScript==
// @name         FOFA 工具箱
// @namespace    fofa.toolbox
// @version      4.7.1
// @description  FOFA 工具箱：FOFA风格深色/浅色模式一键切换；右键任意元素（组件/favicon/国旗/世界地图/相关Icon/各排名条目…）排除或包含该条件并在新标签打开；Alt+拖拽框选批量排除；Alt+Q 工具箱=指纹收藏库（表格编辑、JSON/CSV 导出导入）+ 查询编辑器（结构化拆分当前语句、Alt+A/O 快捷且/或、一键一月内/排除云服务并搜索）+ 知识库（厂商贴牌关系、Server/Title、可粘贴产品截图）。Shift+右键 = 原生菜单
// @match        *://fofa.info/*
// @match        *://*.fofa.info/*
// @match        *://fofa.so/*
// @match        *://*.fofa.so/*
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const MAX_TEXT_LEN = 60;
  const VER = "4.7.1";
  const COUNTRY_ZH = {
    "中国": "CN",
    "美国": "US",
    "日本": "JP",
    "韩国": "KR",
    "朝鲜": "KP",
    "香港": "HK",
    "澳门": "MO",
    "台湾": "TW",
    "新加坡": "SG",
    "德国": "DE",
    "法国": "FR",
    "英国": "GB",
    "俄罗斯": "RU",
    "加拿大": "CA",
    "澳大利亚": "AU",
    "印度": "IN",
    "巴西": "BR",
    "荷兰": "NL",
    "意大利": "IT",
    "西班牙": "ES",
    "越南": "VN",
    "泰国": "TH",
    "印度尼西亚": "ID",
    "马来西亚": "MY",
    "菲律宾": "PH",
    "土耳其": "TR",
    "伊朗": "IR",
    "以色列": "IL",
    "乌克兰": "UA",
    "波兰": "PL",
    "瑞士": "CH",
    "瑞典": "SE",
    "挪威": "NO",
    "丹麦": "DK",
    "芬兰": "FI",
    "比利时": "BE",
    "奥地利": "AT",
    "爱尔兰": "IE",
    "新西兰": "NZ",
    "墨西哥": "MX",
    "阿根廷": "AR",
    "南非": "ZA",
    "埃及": "EG",
    "阿联酋": "AE",
    "沙特阿拉伯": "SA",
    "巴基斯坦": "PK",
    "孟加拉国": "BD",
    "缅甸": "MM",
    "柬埔寨": "KH",
    "老挝": "LA",
    "蒙古": "MN",
    "捷克": "CZ",
    "希腊": "GR",
    "葡萄牙": "PT",
    "匈牙利": "HU",
    "罗马尼亚": "RO",
    "保加利亚": "BG",
    "白俄罗斯": "BY",
    "卢森堡": "LU",
    "智利": "CL",
    "哥伦比亚": "CO",
    "秘鲁": "PE",
    "委内瑞拉": "VE",
    "尼日利亚": "NG",
    "肯尼亚": "KE",
    "印尼": "ID"
  };
  const COUNTRY_EN = {
    china: "CN",
    "united states": "US",
    "united kingdom": "GB",
    "russia": "RU",
    "japan": "JP",
    "korea": "KR",
    "south korea": "KR",
    germany: "DE",
    france: "FR",
    australia: "AU",
    india: "IN",
    brazil: "BR",
    netherlands: "NL",
    italy: "IT",
    spain: "ES",
    vietnam: "VN",
    thailand: "TH",
    singapore: "SG",
    indonesia: "ID",
    malaysia: "MY",
    philippines: "PH",
    turkey: "TR",
    iran: "IR",
    israel: "IL",
    ukraine: "UA",
    poland: "PL",
    switzerland: "CH",
    sweden: "SE",
    norway: "NO",
    denmark: "DK",
    finland: "FI",
    belgium: "BE",
    austria: "AT",
    ireland: "IE",
    "new zealand": "NZ",
    mexico: "MX",
    argentina: "AR",
    "south africa": "ZA",
    egypt: "EG",
    "united arab emirates": "AE",
    "saudi arabia": "SA",
    pakistan: "PK",
    bangladesh: "BD",
    myanmar: "MM",
    cambodia: "KH",
    laos: "LA",
    mongolia: "MN",
    czechia: "CZ",
    czech: "CZ",
    greece: "GR",
    portugal: "PT",
    hungary: "HU",
    romania: "RO",
    bulgaria: "BG",
    belarus: "BY",
    luxembourg: "LU",
    chile: "CL",
    colombia: "CO",
    peru: "PE",
    venezuela: "VE",
    nigeria: "NG",
    kenya: "KE",
    taiwan: "TW",
    "hong kong": "HK",
    macao: "MO"
  };
  const NAME2CODE = Object.assign({}, COUNTRY_EN, COUNTRY_ZH);
  const PROTO_SET = /* @__PURE__ */ new Set(["http", "https", "ssh", "ftp", "sftp", "telnet", "smtp", "pop3", "imap", "rdp", "vnc", "snmp", "mysql", "redis", "mongodb", "memcached", "elasticsearch", "rabbitmq", "kafka", "zookeeper", "nfs", "smb", "ldap", "ldaps", "dns", "socks5", "socks4", "rtsp", "onvif", "bacnet", "modbus", "mqtt", "amqp", "svn", "ipp", "mms"]);
  function fmtDate(d) {
    const p = (n) => n < 10 ? "0" + n : String(n);
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function monthAgoOf(now) {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    first.setDate(Math.min(now.getDate(), lastDay));
    return fmtDate(first);
  }
  function substituteBuiltinSyntax(val, now) {
    const yesterday = fmtDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    return String(val || "").replace(/yesterday/gi, yesterday).replace(/lastmonth/gi, monthAgoOf(now));
  }
  const AFTER_VAL_RE = /(after\s*={1,2}(?!=)\s*")([^"]*)(")/g;
  function resolveQuery(q, monthMode, now) {
    now = now || /* @__PURE__ */ new Date();
    let out = String(q || "");
    out = out.replace(AFTER_VAL_RE, (m, a, val, b) => a + (monthMode ? monthAgoOf(now) : substituteBuiltinSyntax(val, now)) + b);
    return out;
  }
  function hasBuiltinSyntax(q) {
    let hit = false;
    String(q || "").replace(AFTER_VAL_RE, (m, a, val) => {
      if (/yesterday|lastmonth/i.test(val)) hit = true;
      return m;
    });
    return hit;
  }
  const EDITOR_FIELDS = [
    "after",
    "app",
    "asn",
    "base_protocol",
    "banner",
    "banner_fid",
    "banner_hash",
    "before",
    "body",
    "body_hash",
    "category",
    "cert",
    "cert.domain",
    "cert.is_equal",
    "cert.is_expired",
    "cert.is_match",
    "cert.is_valid",
    "cert.issuer",
    "cert.issuer.cn",
    "cert.issuer.org",
    "cert.not_after.after",
    "cert.not_after.before",
    "cert.not_before.after",
    "cert.not_before.before",
    "cert.sn",
    "cert.subject",
    "cert.subject.cn",
    "cert.subject.org",
    "city",
    "cloud_name",
    "cname",
    "cname_domain",
    "country",
    "domain",
    "fid",
    "header",
    "header_hash",
    "host",
    "icp",
    "icon_hash",
    "ip",
    "is_cloud",
    "is_domain",
    "is_fraud",
    "is_honeypot",
    "is_ipv6",
    "jarm",
    "js_md5",
    "js_name",
    "org",
    "os",
    "port",
    "product",
    "product.version",
    "protocol",
    "region",
    "sdk_hash",
    "server",
    "status_code",
    "title",
    "tls.ja3s",
    "tls.version",
    "type"
  ];
  const AC_BOOLEAN_FIELDS = /* @__PURE__ */ new Set([
    "is_cloud",
    "is_cloude",
    "is_domain",
    "is_fraud",
    "is_honeypot",
    "is_ipv6",
    "cert.is_equal",
    "cert.is_expired",
    "cert.is_match",
    "cert.is_valid"
  ]);
  function valueCandidates(field) {
    const f = String(field || "").toLowerCase();
    if (AC_BOOLEAN_FIELDS.has(f)) return ["true", "false"];
    if (f === "protocol") return Array.from(PROTO_SET).sort();
    if (f === "after" || f === "before") return ["YESTERDAY", "LastMonth", fmtDate(/* @__PURE__ */ new Date()), monthAgoOf(/* @__PURE__ */ new Date())];
    return [];
  }
  function textCompleteContext(text, caret) {
    const t = String(text || "");
    const before = t.slice(0, caret);
    let m = /([A-Za-z_][\w.]*)\s*(==|=|!=)\s*"([^"]*)$/.exec(before);
    if (m) {
      if (m[3] === "") {
        if (!/([A-Za-z_][\w.]*)\s*(==|=|!=)\s*"$/.test(before)) return { kind: null, token: "" };
      }
      return { kind: "value", field: m[1], token: m[3], quoted: true, atClose: t.charAt(caret) === '"' };
    }
    m = /(?:^|[^A-Za-z_.])([A-Za-z_][\w.]*)\s*(==|=|!=)\s*([^\s"()&|]*)$/.exec(before);
    if (m) return { kind: "value", field: m[1], token: m[3], quoted: false, atClose: false };
    m = /(?:^|[^A-Za-z_.])([A-Za-z_][\w.]*)$/.exec(before);
    if (m && EDITOR_FIELDS.indexOf(m[1].toLowerCase()) >= 0) return { kind: "op", field: m[1], token: m[1] };
    if (before.endsWith("&") && !before.endsWith("&&")) return { kind: "join", token: "&" };
    if (before.endsWith("|") && !before.endsWith("||")) return { kind: "join", token: "|" };
    m = /([A-Za-z_][\w.]*)$/.exec(before);
    if (m && m[1]) return { kind: "field", token: m[1] };
    return { kind: null, token: "" };
  }
  function completeCandidates(ctx) {
    if (!ctx || !ctx.kind) return [];
    const tok = String(ctx.token || "");
    const low = (s) => s.toLowerCase();
    if (ctx.kind === "field") {
      if (!tok) return [];
      return EDITOR_FIELDS.filter((f) => f !== tok && low(f).startsWith(low(tok)));
    }
    if (ctx.kind === "value") {
      const suffix = ctx.quoted && !ctx.atClose ? '"' : "";
      return valueCandidates(ctx.field).filter((v) => v !== tok && low(v).startsWith(low(tok))).map((v) => v + suffix);
    }
    if (ctx.kind === "op") return ['="', '=="', "!="].map((o) => ctx.token + o);
    if (ctx.kind === "join") return [tok + tok];
    return [];
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function downloadFile(name, content, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  }
  const ac = { el: null, ctx: null, cands: [], idx: 0, ghost: null, dd: null };
  function acHideVisual() {
    if (ac.ghost) ac.ghost.style.display = "none";
    if (ac.dd) ac.dd.style.display = "none";
  }
  function acHide() {
    acHideVisual();
    ac.el = null;
    ac.ctx = null;
    ac.cands = [];
    ac.idx = 0;
  }
  function acHost() {
    return ac.el && (ac.el.closest("#fofa-toolbox-box") || ac.el.closest("#fofa-preset-mgr")) || document.documentElement;
  }
  function acEnsure() {
    const host = acHost();
    if (ac.ghost && ac.ghost.parentNode === host) return;
    if (!ac.ghost) {
      ac.ghost = document.createElement("div");
      ac.ghost.id = "fofa-ac-ghost";
      ac.dd = document.createElement("div");
      ac.dd.id = "fofa-ac-dd";
      ac.dd.addEventListener("mousedown", (e) => {
        const it = e.target.closest && e.target.closest(".ac-it");
        if (!it) return;
        e.preventDefault();
        ac.idx = +it.dataset.i;
        acApply();
      });
    }
    host.appendChild(ac.ghost);
    host.appendChild(ac.dd);
  }
  function acTarget(el) {
    if (!el || !el.dataset) return null;
    if (el.classList && el.classList.contains("fx-e-qtext")) return el;
    if (el.tagName === "INPUT" && (el.dataset.f === "field" || el.dataset.f === "value")) return el;
    return null;
  }
  function acContextOf(el) {
    if (el.classList.contains("fx-e-qtext")) return textCompleteContext(el.value, el.selectionStart);
    if (el.dataset.f === "field") return { kind: "field", token: el.value.slice(0, el.selectionStart) };
    if (el.dataset.f === "value") {
      const fld = el.closest(".fx-e-group") && el.closest(".fx-e-group").querySelector(".fx-e-cfld");
      return { kind: "value", field: fld ? fld.value : "", token: el.value.slice(0, el.selectionStart), quoted: false, atClose: false };
    }
    return { kind: null, token: "" };
  }
  function acFocus(el) {
    ac.el = el;
    acRefresh();
  }
  function acRefresh() {
    if (!ac.el || !ac.el.isConnected || document.activeElement !== ac.el) return acHideVisual();
    const el = ac.el;
    if (el.selectionStart !== el.selectionEnd) return acHideVisual();
    ac.ctx = acContextOf(el);
    ac.cands = completeCandidates(ac.ctx).slice(0, 10);
    ac.idx = 0;
    if (!ac.cands.length) return acHideVisual();
    acEnsure();
    acRenderGhost();
    acRenderDd();
  }
  function acRenderGhost() {
    const el = ac.el, g = ac.ghost;
    const ins = ac.cands[ac.idx].slice(String(ac.ctx.token || "").length);
    if (!ins) {
      g.style.display = "none";
      return;
    }
    const caret = el.selectionStart;
    const ta = el.classList.contains("fx-e-qtext");
    const cs = getComputedStyle(el);
    const host = acHost(), hr = host.getBoundingClientRect(), r = el.getBoundingClientRect();
    g.className = ta ? "ta" : "in";
    g.style.font = cs.font || cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + "/" + cs.lineHeight + " " + cs.fontFamily;
    g.innerHTML = "";
    const mk = (cls, txt) => {
      const sp = document.createElement("span");
      if (cls) sp.className = cls;
      sp.textContent = txt;
      g.appendChild(sp);
    };
    mk("", el.value.slice(0, caret));
    mk("sug", ins);
    mk("", el.value.slice(caret) + "​");
    if (ta) {
      g.style.padding = cs.padding;
      g.style.left = r.left - hr.left + "px";
      g.style.top = r.top - hr.top + "px";
      g.style.width = r.width + "px";
      g.style.height = r.height + "px";
      g.style.lineHeight = "";
      g.scrollTop = el.scrollTop;
      g.scrollLeft = el.scrollLeft;
    } else {
      g.style.padding = "0";
      g.style.left = r.left - hr.left + el.clientLeft + parseFloat(cs.paddingLeft || "0") + "px";
      g.style.top = r.top - hr.top + "px";
      g.style.width = "";
      g.style.height = "";
      g.style.lineHeight = r.height + "px";
    }
    g.style.display = "block";
  }
  function acRenderDd() {
    const el = ac.el, d = ac.dd;
    d.innerHTML = '<div class="ac-hint">TAB 补全 · ↑↓ 切换</div>' + ac.cands.map((c, i) => `<div class="ac-it${i === ac.idx ? " on" : ""}" data-i="${i}">${esc(c)}</div>`).join("");
    const host = acHost(), hr = host.getBoundingClientRect(), r = el.getBoundingClientRect();
    d.style.display = "block";
    const below = hr.bottom - r.bottom - 6;
    const above = r.top - hr.top - 6;
    const useAbove = above > below;
    d.style.maxHeight = Math.min(240, Math.max(96, useAbove ? above : below)) + "px";
    d.style.left = Math.max(4, Math.min(r.left - hr.left, hr.width - d.offsetWidth - 4)) + "px";
    d.style.top = (useAbove ? r.top - hr.top - d.offsetHeight - 2 : r.bottom - hr.top + 2) + "px";
    d.querySelectorAll(".ac-it").forEach((it) => {
      it.addEventListener("mouseenter", () => {
        ac.idx = +it.dataset.i;
        d.querySelectorAll(".ac-it").forEach((x) => x.classList.toggle("on", x === it));
        acRenderGhost();
      });
    });
  }
  function acApply() {
    const el = ac.el;
    if (!el || !ac.cands.length) return;
    const full = ac.cands[ac.idx];
    const s = el.selectionStart;
    const start = Math.max(0, s - String(ac.ctx.token || "").length);
    try {
      el.setRangeText(full, start, s, "end");
    } catch (e) {
      return;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    acRefresh();
  }
  function acKeydown(e) {
    if (!ac.el || e.target !== ac.el) return;
    const open = !!ac.cands.length && !!ac.dd && ac.dd.isConnected && ac.dd.style.display !== "none";
    if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (open) acApply();
      return;
    }
    if (!open) return;
    const n = ac.cands.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      ac.idx = (ac.idx + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
      acRenderGhost();
      acRenderDd();
    } else if (e.key === "Enter" && !e.altKey && !e.ctrlKey && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      e.stopPropagation();
      acApply();
    }
  }
  function initComplete() {
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && ac.dd && ac.dd.isConnected && ac.dd.style.display !== "none") {
        e.preventDefault();
        e.stopPropagation();
        acHideVisual();
      }
    }, true);
    window.addEventListener("scroll", acHideVisual, true);
    window.addEventListener("resize", acHideVisual);
  }
  function negate(cond) {
    const m = /^\s*([A-Za-z_][\w.]*)\s*={1,2}(?!=)\s*([\s\S]+?)\s*$/.exec(cond);
    return m ? `${m[1]}!=${m[2]}` : null;
  }
  const ensureNeg = (c) => negate(c) || c.replace(/^(\s*[A-Za-z_][\w.]*\s*)={1,2}(?!=)/, "$1!=");
  const ensurePos = (c) => c.replace(/^(\s*[A-Za-z_][\w.]*\s*)!=/, "$1=");
  function splitTop(q) {
    const parts = [];
    let depth = 0, inStr = false, buf = "";
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      if (inStr) {
        buf += c;
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        buf += c;
        continue;
      }
      if (c === "(") {
        depth++;
        buf += c;
        continue;
      }
      if (c === ")") {
        depth = depth > 0 ? depth - 1 : 0;
        buf += c;
        continue;
      }
      if (depth === 0 && c === "&" && q[i + 1] === "&") {
        parts.push(buf.trim());
        buf = "";
        i++;
        continue;
      }
      buf += c;
    }
    parts.push(buf.trim());
    return parts.filter(Boolean);
  }
  function extractNew(linkQuery, current) {
    const norm = (s) => String(s).replace(/\s+/g, " ").trim();
    const lq = norm(linkQuery);
    const cur = norm(current || "");
    if (!cur) return lq;
    if (lq === cur) return null;
    if (lq.startsWith(cur + " && ")) return lq.slice(cur.length + 4).trim() || null;
    const flat = (s) => String(s).replace(/\s+/g, "");
    const curFlat = flat(cur);
    const has = (s) => curFlat.includes(flat(s));
    const walk = (q) => {
      const extra = [];
      for (const s of splitTop(q)) {
        if (has(s)) continue;
        const inner = s.startsWith("(") && s.endsWith(")") ? s.slice(1, -1) : null;
        if (inner !== null && has(inner)) continue;
        if (inner !== null) {
          const r = walk(inner);
          if (r) return r;
        }
        extra.push(s);
      }
      return extra.length === 1 ? extra[0] : null;
    };
    return walk(lq);
  }
  function condInQuery(q, cond) {
    const flat = (s) => String(s).replace(/\s+/g, "");
    return flat(q || "").includes(flat(cond));
  }
  function flattenLeaves(q) {
    const out = [];
    const rec = (s) => {
      for (const part of splitTop(String(s).replace(/\s+/g, " ").trim())) {
        const p = part.trim();
        if (p.startsWith("(") && p.endsWith(")")) rec(p.slice(1, -1));
        else out.push(p);
      }
    };
    rec(q);
    return out;
  }
  function selfCondition(lq, linkText) {
    const txt = String(linkText || "").trim();
    if (!txt) return null;
    for (const leaf of flattenLeaves(lq)) {
      const m = /^\s*([A-Za-z_][\w.]*)\s*={1,2}(?!=)\s*"([^"]*)"\s*$/.exec(leaf);
      if (m && m[2] === txt) return leaf;
    }
    return null;
  }
  const ICON_MAP = {
    exclude: ["jianhao", "🚫"],
    // − 排除/取反
    include: ["jiahao", "➕"],
    // + 且包含
    includeOr: ["jiahao1", "➕"],
    // + 或包含
    add: ["icon-shouqi", "＋"],
    // ＋ 新建（十字）
    plus: ["jiahao1", "＋"],
    // ＋ 值（十字）
    expand: ["jiahaozhankai", "⊞"],
    // 展开/收起（预设快插等）
    folderExpand: ["icon-shouqi", "＋"],
    // 文件夹组头-展开（十字，与「展开用 icon-shouqi」规则一致）
    folderCollapse: ["icon-zhankai", "－"],
    // 文件夹组头-收起
    edit: ["bianji", "✏️"],
    search: ["search", "🔍"],
    close: ["guanbi", "✕"],
    // 行内小 ✕（删行/收起）
    del: ["shanchu", "✕"],
    // 删除条目（垃圾桶）
    save: ["baocun", "💾"],
    copy: ["fuzhi", "📋"],
    time: ["shijian", "📅"],
    cloud: ["cloud", "☁️"],
    refresh: ["shuaxin", "↻"],
    blank: ["ico-file-format-variant", "📄"],
    lib: ["renwu2-01", "🗂"],
    // 指纹库
    kb: ["guide", "📚"],
    // 知识库
    presetMgr: ["guanlishitu", "⚙"],
    // 管理预设
    toolbox: ["yingyong", "🧰"],
    theme: ["huanfu", "☀"],
    // 深浅色切换（换肤）
    pin: ["paixu-01", "📌"],
    // 置顶（排序）
    folder: ["renwu1-01", "📁"],
    // 文件夹（归档按钮/组头/筛选 chips）
    dedup: ["huo", "🧹"],
    // 去重瘦身
    quick: ["zhedie", "⚡"],
    // 快速操作（展开/收起下拉）
    undo: ["huiche-01", "↩"],
    // 撤销
    globe: ["diqiu", "🌏"],
    batch: ["piliang-01", "📦"],
    // 批量 / 暂存
    drag: ["shangxiatuodong", "⠿"],
    // 行拖动手柄
    ok: ["duihao", "✅"],
    warn: ["jinggao", "⚠️"],
    err: ["cuo", "❌"],
    check: ["duihao2", "☑"],
    rubber: ["drap-01", "⊞"]
    // Alt+拖拽框选
  };
  let iconFontOk = true;
  function initIcons() {
    try {
      const probe = document.createElement("i");
      probe.className = "fx-ic";
      probe.style.cssText = "position:fixed;left:-9px;top:-9px;width:8px;height:8px;overflow:hidden";
      document.documentElement.appendChild(probe);
      document.fonts.load("12px fx-icons", "").then((loaded) => {
        probe.remove();
        iconFontOk = loaded.length > 0;
        document.documentElement.classList.toggle("fx-icons-off", !iconFontOk);
      }).catch(() => {
        probe.remove();
        iconFontOk = false;
        document.documentElement.classList.add("fx-icons-off");
      });
    } catch (e) {
    }
  }
  function ic(name, fallback) {
    const def = ICON_MAP[name];
    if (!def) return fallback || "";
    return `<i class="fx-ic fx-ic-${def[0]}"></i><span class="fx-fb">${def[1]}</span>`;
  }
  function attachRowDrag(pane, canDrop, move) {
    let dragId = null;
    pane.addEventListener("dragstart", (e) => {
      const h = e.target.closest && e.target.closest(".fx-rowdrag");
      if (!h) return;
      const tr = h.closest("tr");
      dragId = tr.dataset.id;
      tr.classList.add("fx-dragging");
      try {
        e.dataTransfer.setData("text/plain", dragId);
      } catch (err) {
      }
      e.dataTransfer.effectAllowed = "move";
    });
    pane.addEventListener("dragend", () => {
      dragId = null;
      pane.querySelectorAll("tr.fx-dragging,tr.fx-drop-above,tr.fx-drop-below").forEach((tr) => tr.classList.remove("fx-dragging", "fx-drop-above", "fx-drop-below"));
    });
    const clearMarks = () => pane.querySelectorAll("tr.fx-drop-above,tr.fx-drop-below").forEach((x) => x.classList.remove("fx-drop-above", "fx-drop-below"));
    pane.addEventListener("dragover", (e) => {
      const tr = e.target.closest && e.target.closest("tr[data-id]");
      clearMarks();
      if (!dragId || !tr || tr.dataset.id === dragId || !canDrop(dragId, tr.dataset.id)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const r = tr.getBoundingClientRect();
      const before = e.clientY - r.top < r.height / 2;
      tr.classList.add(before ? "fx-drop-above" : "fx-drop-below");
      tr.dataset.dropBefore = before ? "1" : "0";
    });
    pane.addEventListener("drop", (e) => {
      const tr = e.target.closest && e.target.closest("tr[data-id]");
      if (!dragId || !tr || tr.dataset.id === dragId) return;
      e.preventDefault();
      const before = tr.dataset.dropBefore === "1";
      const id = dragId;
      dragId = null;
      pane.querySelectorAll("tr.fx-dragging,tr.fx-drop-above,tr.fx-drop-below").forEach((x) => x.classList.remove("fx-dragging", "fx-drop-above", "fx-drop-below"));
      move(id, tr.dataset.id, before);
    });
  }
  function readImportText(f, cb) {
    const rd = new FileReader();
    rd.onload = () => {
      const buf = new Uint8Array(rd.result);
      let text = new TextDecoder("utf-8").decode(buf);
      if (!(buf[0] === 239 && buf[1] === 187 && buf[2] === 191) && text.indexOf("�") >= 0) {
        try {
          text = new TextDecoder("gbk").decode(buf);
        } catch (e) {
        }
      }
      cb(text);
    };
    rd.onerror = () => cb(null);
    rd.readAsArrayBuffer(f);
  }
  function importToast(html) {
    const old = document.getElementById("fofa-imp-toast");
    if (old) old.remove();
    const t = document.createElement("div");
    t.id = "fofa-imp-toast";
    t.innerHTML = html;
    t.addEventListener("click", () => t.remove());
    document.documentElement.appendChild(t);
    setTimeout(() => {
      if (t.parentNode) t.remove();
    }, 4500);
  }
  function inFolderView(it, view) {
    if (view === "*") return !String(it.folder || "").trim();
    if (view) return String(it.folder || "").trim() === String(view);
    return true;
  }
  function updateSelBar(pane) {
    const bar = pane.querySelector(".fx-l-selbar");
    if (!bar) return;
    const on = pane.dataset.selecting === "1";
    bar.style.display = on ? "" : "none";
    if (on) bar.innerHTML = `
    <span class="fx-l-selcnt">已选 <b>${pane.querySelectorAll("td.fx-l-sel input:checked").length}</b> 项</span>
    <button class="fx-l-selmove" title="把选中的条目移动到指定文件夹（输入名字=移动到该文件夹；清空=移出文件夹）">${ic("folder")} 移动到文件夹…</button>
    <button class="fx-l-selall" title="选中 / 取消当前视图里显示的全部条目">${ic("check")} 全选</button>
    <button class="fx-l-selexit" title="退出批量选择">${ic("close")} 退出</button>`;
  }
  function updateSelBarCnt(pane) {
    const b = pane.querySelector(".fx-l-selcnt b");
    if (b) b.textContent = String(pane.querySelectorAll("td.fx-l-sel input:checked").length);
  }
  function batchMoveSelected(pane, load, save, render) {
    const boxes = Array.from(pane.querySelectorAll("td.fx-l-sel input:checked"));
    if (!boxes.length) {
      importToast(`${ic("warn")} 还没有选中任何条目`);
      return;
    }
    const curView = pane.dataset.folder || "";
    const pre = curView && curView !== "*" ? curView : "";
    const name = window.prompt(`把选中的 ${boxes.length} 项移动到哪个文件夹？（输入名字=移动到该文件夹；清空=移出文件夹）`, pre);
    if (name === null) return;
    const fo = name.trim();
    const arr = load();
    let n = 0;
    for (const b of boxes) {
      const it = arr.find((x) => String(x.id) === b.closest("tr").dataset.id);
      if (it && String(it.folder || "").trim() !== fo) {
        it.folder = fo;
        n++;
      }
    }
    if (n) save(arr);
    delete pane.dataset.selecting;
    render(pane);
    importToast(fo ? `${ic("folder")} 已把 <b>${n}</b> 项移动到「${esc(fo)}」` : `${ic("folder")} 已把 <b>${n}</b> 项移出文件夹`);
  }
  function groupList(list, keyFn) {
    const map = /* @__PURE__ */ new Map();
    for (const it of list) {
      const k = keyFn(it) || "";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    }
    return [...map.entries()].sort((a, b) => (a[0] === "" ? 1 : 0) - (b[0] === "" ? 1 : 0) || a[0].localeCompare(b[0], "zh")).map(([group, items]) => ({ group, items }));
  }
  function splitOrTop(q) {
    const parts = [];
    let depth = 0, inStr = false, buf = "";
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      if (inStr) {
        buf += c;
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        buf += c;
        continue;
      }
      if (c === "(") {
        depth++;
        buf += c;
        continue;
      }
      if (c === ")") {
        depth = depth > 0 ? depth - 1 : 0;
        buf += c;
        continue;
      }
      if (depth === 0 && c === "|" && q[i + 1] === "|") {
        parts.push(buf.trim());
        buf = "";
        i++;
        continue;
      }
      buf += c;
    }
    parts.push(buf.trim());
    return parts.filter(Boolean);
  }
  function stripWrapParens(s) {
    s = String(s).trim();
    while (s.startsWith("(") && s.endsWith(")")) {
      let depth = 0, inStr = false, wraps = true;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (inStr) {
          if (c === '"') inStr = false;
          continue;
        }
        if (c === '"') {
          inStr = true;
          continue;
        }
        if (c === "(") depth++;
        else if (c === ")") {
          if (depth > 0) depth--;
          if (depth === 0 && i < s.length - 1) {
            wraps = false;
            break;
          }
        }
      }
      if (!wraps || depth !== 0) break;
      s = s.slice(1, -1).trim();
    }
    return s;
  }
  function balanceParens(q) {
    let out = "", inStr = false, opens = 0;
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      if (inStr) {
        out += c;
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        out += c;
        continue;
      }
      if (c === "(") {
        opens++;
        out += c;
        continue;
      }
      if (c === ")") {
        if (opens > 0) {
          opens--;
          out += c;
        }
        continue;
      }
      out += c;
    }
    return out + ")".repeat(opens);
  }
  function parseCondOne(s) {
    s = String(s).trim();
    const kw = /^"([^"]*)"$/.exec(s);
    if (kw) return { field: "", op: "", value: kw[1] };
    const m = /^([A-Za-z_][\w.]*)\s*(==|!=|=)\s*([\s\S]*)$/.exec(s);
    if (!m) return null;
    let v = m[3].trim();
    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    return { field: m[1], op: m[2], value: v };
  }
  function parseQueryToCards(q) {
    const cards = [];
    const byField = /* @__PURE__ */ new Map();
    const addSeg = (seg) => {
      const alts = splitOrTop(stripWrapParens(seg)).filter(Boolean);
      if (!alts.length) return;
      if (alts.length === 1) {
        const row = parseCondOne(alts[0]);
        if (!row) {
          const subs = splitTop(stripWrapParens(seg));
          if (subs.length > 1) {
            subs.forEach(addSeg);
            return;
          }
          cards.push({ raw: seg });
          return;
        }
        const slim = { op: row.op, value: row.value };
        if (!row.field) {
          cards.push({ field: "", join: "&&", rows: [slim] });
          return;
        }
        const key = row.field.toLowerCase();
        const c = byField.get(key);
        if (c) c.rows.push(slim);
        else {
          const card = { field: row.field, join: "&&", rows: [slim] };
          byField.set(key, card);
          cards.push(card);
        }
        return;
      }
      const rows = alts.map((a) => parseCondOne(a));
      if (rows.every((r) => r && r.field && r.field.toLowerCase() === rows[0].field.toLowerCase())) {
        cards.push({ field: rows[0].field, join: "||", rows: rows.map((r) => ({ op: r.op, value: r.value })) });
      } else {
        cards.push({ raw: seg });
      }
    };
    for (const part of splitTop(balanceParens(String(q || "").trim()))) {
      const peeled = stripWrapParens(part);
      const segs = splitTop(peeled);
      segs.forEach((seg) => {
        const n0 = cards.length;
        addSeg(seg);
        if (peeled !== part && segs.length === 1 && cards.length === n0 + 1 && cards[n0].raw != null) {
          cards[n0].raw = part;
        }
      });
    }
    return cards;
  }
  function cardRowQ(card, r) {
    if (r.raw != null) return String(r.raw).trim();
    const v = String(r.value == null ? "" : r.value).replace(/^"+|"+$/g, "");
    if (!card.field) return v ? `"${v}"` : "";
    return v === "" ? "" : `${card.field}${r.op}"${v}"`;
  }
  function cardToQuery(card) {
    if (card.raw != null) return String(card.raw).trim();
    const rows = (card.rows || []).map((r) => cardRowQ(card, r)).filter(Boolean);
    return rows.join(card.join === "||" ? " || " : " && ");
  }
  function cardsToQuery(cards) {
    const parts = [];
    for (const c of cards) {
      if (c.raw != null) {
        const s = String(c.raw).trim();
        if (s) parts.push(s);
        continue;
      }
      const rows = (c.rows || []).map((r) => cardRowQ(c, r)).filter(Boolean);
      if (!rows.length) continue;
      if (rows.length > 1 && c.join === "||") parts.push("(" + rows.join(" || ") + ")");
      else parts.push(rows.join(" && "));
    }
    return parts.join(" && ");
  }
  function dedupeQuery(q) {
    const cards = parseQueryToCards(q);
    const hasPosProduct = cards.some((c) => c.raw == null && c.field.toLowerCase() === "product" && (c.rows || []).some((r) => r.op === "=" || r.op === "=="));
    const out = [];
    for (const c of cards) {
      if (c.raw != null || !c.field || c.join === "||") {
        out.push(c);
        continue;
      }
      if (c.field.toLowerCase() === "category" && hasPosProduct) continue;
      const positives = (c.rows || []).filter((r) => r.op !== "!=" && r.value !== "-");
      if (positives.length) {
        out.push({ field: c.field, join: c.join, rows: [positives[positives.length - 1]] });
      } else {
        const seen = /* @__PURE__ */ new Set();
        const rows = [];
        for (const r of c.rows || []) {
          if (r.value === "-") continue;
          const k = r.op + "" + r.value;
          if (seen.has(k)) continue;
          seen.add(k);
          rows.push(r);
        }
        if (rows.length) out.push({ field: c.field, join: c.join, rows });
      }
    }
    return cardsToQuery(out);
  }
  function dropFieldQuery(q, field) {
    const f = String(field).toLowerCase();
    return cardsToQuery(parseQueryToCards(q).filter((c) => c.raw != null || c.field.toLowerCase() !== f));
  }
  function mergeCards(dest, incoming) {
    const out = dest.slice();
    for (const pc of incoming) {
      if (pc.raw != null) {
        out.push(pc);
        continue;
      }
      const tgt = out.find((c) => c.raw == null && c.field.toLowerCase() === pc.field.toLowerCase() && c.join === pc.join);
      if (tgt) {
        for (const r of pc.rows) if (!tgt.rows.some((x) => x.op === r.op && x.value === r.value)) tgt.rows.push({ op: r.op, value: r.value });
      } else out.push(pc);
    }
    return out;
  }
  const LIB_KEY = "fofa-toolbox-fingerprints";
  const LIB_FIELDS = [
    { key: "name", label: "名称", w: "80px" },
    { key: "query", label: "搜索语句", w: "180px", mono: true },
    { key: "ip", label: "IP数", w: "60px" },
    { key: "product", label: "产品", w: "100px" },
    { key: "category", label: "类型", w: "90px" },
    { key: "region", label: "国家", w: "90px" },
    { key: "server", label: "Server", w: "70px" },
    { key: "title", label: "Title", w: "100px" },
    { key: "after", label: "收录时间", w: "80px" },
    { key: "vendor", label: "厂商", w: "60px" },
    { key: "model", label: "型号", w: "60px" },
    { key: "note", label: "备注", w: "80px" },
    { key: "folder", label: "文件夹", w: "70px" }
  ];
  function loadLib() {
    try {
      const a = JSON.parse(localStorage.getItem(LIB_KEY) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }
  function saveLib(arr) {
    try {
      localStorage.setItem(LIB_KEY, JSON.stringify(arr));
    } catch (e) {
    }
  }
  function grabCounts() {
    const t = document.body ? document.body.innerText || "" : "";
    const num = (re) => {
      const m = re.exec(t);
      return m ? m[1].replace(/[,，\s]/g, "") : "";
    };
    return { total: num(/([\d,，*]+)\s*条匹配结果/), ip: num(/([\d,，*]+)\s*条独立\s*IP/) };
  }
  function grabRankingEntries(kw) {
    const secs = Array.from(document.querySelectorAll(".hsxa-meta-data-statistical-list .hsxa-list-main")).filter((s) => s.offsetHeight > 0);
    const sec = secs.find((x) => ((x.querySelector(".summary-title-content") || {}).textContent || "").indexOf(kw) >= 0);
    if (!sec) return [];
    return Array.from(sec.querySelectorAll("li")).map((li) => {
      const a = li.querySelector("a");
      const cnt = li.querySelector(".titleRight") || li.querySelector('span[style*="flex"]');
      return { name: a ? a.textContent.trim() : "", count: (cnt ? cnt.textContent : "").replace(/[,，\s]/g, "") };
    }).filter((x) => x.name);
  }
  function pickTopSameDigits(entries) {
    if (!entries.length) return [];
    const digits = (v) => String(v).replace(/\D/g, "").length;
    const d0 = digits(entries[0].count);
    if (!d0) return [entries[0].name];
    return entries.filter((x) => digits(x.count) === d0).map((x) => x.name);
  }
  function productFromQuery(q) {
    const m = /(?:^|[^A-Za-z_.])(?:app|product)\s*={1,2}(?!=)\s*"([^"]+)"/.exec(q || "");
    return m ? m[1] : "";
  }
  function pickName(productFromQ, entries) {
    if (productFromQ) return productFromQ;
    if (!entries.length) return "";
    if (entries.length === 1) return entries[0].name;
    const digits = (v) => String(v).replace(/\D/g, "").length;
    if (digits(entries[0].count) > digits((entries[1] || {}).count || "")) return entries[0].name;
    return "";
  }
  function captureFingerprint() {
    const q = currentQuery();
    if (!q) return null;
    const c = grabCounts();
    const clean = (v) => v && v !== "0" ? v : "";
    const productEntries = grabRankingEntries("产品");
    const entry = {
      id: Date.now(),
      name: pickName(productFromQuery(q), productEntries),
      query: q,
      ip: clean(c.ip) || clean(c.total),
      // 产品优先取语句里的 app=/product=，没有对应内容时才用产品排名，再没有就留空
      product: productFromQuery(q) || pickTopSameDigits(productEntries).join("、"),
      // 类型：分类排名里的名字（不带数量）
      category: grabRankingEntries("分类").map((x) => x.name).join("、"),
      region: pickTopSameDigits(grabRankingEntries("国家")).join("、"),
      server: (grabRankingEntries("Server")[0] || {}).name || "",
      title: (grabRankingEntries("网站标题")[0] || {}).name || "",
      // 收录时间直接记录收藏当天的系统日期
      after: fmtDate(/* @__PURE__ */ new Date()),
      vendor: "",
      model: "",
      note: "",
      folder: "",
      ts: (/* @__PURE__ */ new Date()).toLocaleString()
    };
    return entry;
  }
  const csvCell = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  function libToCsv(arr) {
    const head = LIB_FIELDS.map((f) => f.label).concat(["收藏时间"]);
    const lines = [head.map(csvCell).join(",")];
    for (const it of arr) {
      lines.push(LIB_FIELDS.map((f) => it[f.key]).concat([it.ts]).map(csvCell).join(","));
    }
    return "\uFEFF" + lines.join("\r\n");
  }
  const LIB_QUICK_OPS = {
    dedup: { label: "全库去重", fn: dedupeQuery },
    dropcountry: { label: "删除地区", fn: (q) => dropFieldQuery(q, "country") }
  };
  function purgeEmptyLib() {
    try {
      const arr = JSON.parse(localStorage.getItem(LIB_KEY) || "[]");
      if (!Array.isArray(arr)) return;
      const meaningful = arr.filter((it) => it && LIB_FIELDS.some((f) => f.key !== "folder" && String(it[f.key] || "").trim() !== ""));
      if (meaningful.length !== arr.length) localStorage.setItem(LIB_KEY, JSON.stringify(meaningful));
    } catch (e) {
    }
  }
  const KB_KEY = "fofa-toolbox-kb";
  const KB_FIELDS = [
    { key: "parent", label: "母厂/贴牌自", w: "90px" },
    { key: "name", label: "名称", w: "110px" },
    { key: "server", label: "Server", w: "100px", mono: true },
    { key: "title", label: "Title", w: "160px" },
    { key: "note", label: "备注", w: "110px" },
    { key: "folder", label: "文件夹", w: "70px" }
  ];
  function loadKb() {
    try {
      const a = JSON.parse(localStorage.getItem(KB_KEY) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }
  function saveKb(arr) {
    try {
      localStorage.setItem(KB_KEY, JSON.stringify(arr));
      return true;
    } catch (e) {
      importToast(`${ic("warn")} 保存失败：浏览器本地存储空间不足（截图较多时请删除部分图片，或先导出备份再清理）`);
      return false;
    }
  }
  function kbNormEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const it = {
      parent: String(raw.parent == null ? "" : raw.parent).trim(),
      name: String(raw.name == null ? "" : raw.name).trim(),
      server: String(raw.server == null ? "" : raw.server).trim(),
      title: String(raw.title == null ? "" : raw.title).trim(),
      note: String(raw.note == null ? "" : raw.note),
      folder: String(raw.folder == null ? "" : raw.folder).trim(),
      images: Array.isArray(raw.images) ? raw.images.filter((s) => typeof s === "string" && s.indexOf("data:image/") === 0) : [],
      ts: raw.ts == null ? "" : String(raw.ts)
    };
    if (typeof raw.order === "number" && Number.isFinite(raw.order)) it.order = raw.order;
    if (!it.parent && !it.name && !it.server && !it.title && !it.note && !it.images.length) return null;
    return it;
  }
  function newKbEntry() {
    const q = currentQuery() || "";
    return {
      id: Date.now(),
      parent: "",
      name: productFromQuery(q),
      server: (grabRankingEntries("Server")[0] || {}).name || "",
      title: (grabRankingEntries("网站标题")[0] || {}).name || "",
      note: "",
      images: [],
      ts: (/* @__PURE__ */ new Date()).toLocaleString()
    };
  }
  function kbFiltered(filter, folderView) {
    const kw = String(filter || "").trim().toLowerCase();
    const hit = (it) => inFolderView(it, folderView) && (!kw || [it.parent, it.name, it.server, it.title, it.note, it.folder].some((v) => String(v || "").toLowerCase().includes(kw)));
    return loadKb().filter(hit).sort((a, b) => String(a.parent || "").localeCompare(String(b.parent || ""), "zh") || (a.order || 0) - (b.order || 0) || String(a.name || "").localeCompare(String(b.name || ""), "zh"));
  }
  function renderKb(pane) {
    const wrap = pane.querySelector(".fx-k-wrap");
    if (!wrap) return;
    const arr = loadKb();
    const view = pane.dataset.folder || "";
    const folders = /* @__PURE__ */ new Map();
    for (const it of arr) {
      const f = String(it.folder || "").trim();
      if (f) folders.set(f, (folders.get(f) || 0) + 1);
    }
    const unfiled = arr.filter((it) => !String(it.folder || "").trim()).length;
    const chip = (fo, label, on) => `<button class="fx-l-fchip${on ? " on" : ""}" data-fo="${esc(fo)}">${label}</button>`;
    const fbar = pane.querySelector(".fx-k-folders");
    if (fbar) {
      fbar.innerHTML = chip("", `全部 (${arr.length})`, view === "") + chip("*", `未归档 (${unfiled})`, view === "*") + [...folders.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh")).map(([f, n]) => chip(f, `${ic("folder")} ${esc(f)} (${n})`, view === f)).join("");
      fbar.style.display = folders.size || view === "*" ? "" : "none";
    }
    const kw = String(pane.dataset.filter || "").trim();
    const list = kbFiltered(pane.dataset.filter || "", view);
    const cols = KB_FIELDS.filter((f) => f.key !== "folder");
    const selecting = pane.dataset.selecting === "1";
    const rows = list.map((it) => `<tr data-id="${it.id}">${selecting ? `<td class="fx-l-sel"><input type="checkbox" title="选中以批量移动"></td>` : `<td class="fx-rowdrag" draggable="true" title="拖动调整顺序（仅在同一母厂组内）">${ic("drag")}</td>`}${cols.map(
    (f) => `<td${f.mono ? ' class="fx-l-mono"' : ""} data-f="${f.key}" contenteditable="true" spellcheck="false">${esc(it[f.key] || "")}</td>`
  ).join("")}
    <td class="fx-k-imgs" tabindex="0" title="点击聚焦后 Ctrl+V 粘贴产品截图">${(it.images || []).map(
    (src, i) => `<span class="fx-k-thumbwrap"><img class="fx-k-thumb" data-i="${i}" src="${src}" title="点击放大"><b class="fx-k-imgdel" data-i="${i}" title="删除此图">${ic("close")}</b></span>`
  ).join("")}<b class="fx-k-addimg" title="选择图片文件">📎</b>${(it.images || []).length ? "" : '<span class="fx-k-hint">点击后 Ctrl+V 粘贴</span>'}</td>
    <td class="fx-l-ops"><b class="fx-l-filebtn" title="归档到文件夹：输入名字归档/移动，清空则移出文件夹">${ic("folder")}</b><b class="fx-k-del" title="删除此条">${ic("del")}</b></td></tr>`).join("");
    const cnt = pane.querySelector(".fx-l-count");
    if (cnt) cnt.textContent = kw ? `共 ${arr.length} 条，匹配 ${list.length} 条` : `共 ${arr.length} 条`;
    wrap.innerHTML = `<table class="fx-l-table">
    <thead><tr><th style="width:26px"></th>${cols.map((f) => `<th style="width:${f.w}">${f.label}</th>`).join("")}<th>产品截图</th><th>操作</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="${cols.length + 3}" class="fx-l-empty">${kw ? "没有匹配的记录：换个关键词，或清空搜索框" : view ? `此视图暂无记录：在其他视图用行内 ${ic("folder")} 归档进来` : `暂无记录：点「${ic("add")} 新建」，在结果页会自动预填 Server/Title；截图列点击后 Ctrl+V 粘贴产品前端`}</td></tr>`}</tbody>
  </table>`;
    updateSelBar(pane);
  }
  function kbBlobToDataUrl(blob, cb) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const MAXW = 640;
      const scale = Math.min(1, MAXW / (img.naturalWidth || MAXW));
      const w = Math.max(1, Math.round((img.naturalWidth || MAXW) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || 360) * scale));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cb(cv.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      cb(null);
    };
    img.src = url;
  }
  function kbAddImage(pane, id, blob) {
    kbBlobToDataUrl(blob, (data) => {
      if (!data) {
        importToast(`${ic("warn")} 截图读取失败：不是有效的图片`);
        return;
      }
      const arr = loadKb();
      const it = arr.find((x) => String(x.id) === String(id));
      if (!it) return;
      it.images = it.images || [];
      it.images.push(data);
      if (saveKb(arr)) renderKb(pane);
    });
  }
  function kbLightbox(src) {
    const old = document.getElementById("fofa-kb-lightbox");
    if (old) {
      old.remove();
      return;
    }
    const lb = document.createElement("div");
    lb.id = "fofa-kb-lightbox";
    const im = document.createElement("img");
    im.src = src;
    lb.appendChild(im);
    lb.addEventListener("click", () => lb.remove());
    document.documentElement.appendChild(lb);
  }
  function kbImport(pane) {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,application/json";
    inp.style.display = "none";
    inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      readImportText(f, (text) => {
        if (text == null) {
          importToast(`${ic("warn")} 导入失败：文件读取错误`);
          return;
        }
        let raws;
        try {
          raws = JSON.parse(String(text).replace(/^\ufeff/, ""));
        } catch (err) {
          importToast(`${ic("warn")} 导入失败：JSON 解析失败（${esc(err.message)}）`);
          return;
        }
        if (!Array.isArray(raws)) {
          importToast(`${ic("warn")} 导入失败：JSON 内容不是知识库数组`);
          return;
        }
        const arr = loadKb();
        const ids = new Set(arr.map((x) => x.id));
        const keyOf = (it) => [it.parent, it.name, it.server, it.title].join(" | ");
        const seen = new Set(arr.map(keyOf));
        let added = 0, skipped = 0;
        for (const raw of raws) {
          const it = kbNormEntry(raw);
          if (!it) continue;
          const k = keyOf(it);
          if (seen.has(k)) {
            skipped++;
            continue;
          }
          seen.add(k);
          let id = Number(raw.id);
          if (!raw.id || !Number.isFinite(id) || ids.has(id)) {
            do {
              id = Date.now() + Math.floor(Math.random() * 1e6);
            } while (ids.has(id));
          }
          it.id = id;
          ids.add(id);
          arr.push(it);
          added++;
        }
        if (added) saveKb(arr);
        if (pane && pane.isConnected) renderKb(pane);
        importToast(`${ic("ok")} 知识库导入：新增 <b>${added}</b> 条，跳过 <b>${skipped}</b> 条（重复）`);
      });
    });
    document.body.appendChild(inp);
    inp.click();
  }
  function buildKb(pane) {
    pane.innerHTML = `
    <div class="fx-l-tools">
      <input class="fx-k-search" placeholder="搜索：母厂 / 名称 / Server / Title / 备注 / 文件夹" spellcheck="false">
      <span class="fx-l-count">共 0 条</span>
      <button class="fx-k-add" title="新建记录：结果页会自动预填 名称/Server/Title；在某个文件夹视图里新建会自动归档进该文件夹">${ic("add")} 新建</button>
      <button class="fx-l-quickbtn" title="批量操作：批量移动到文件夹等">${ic("quick")} 快速操作</button>
      <button class="fx-k-expj" title="导出为 JSON 文件（含截图）">导出 JSON</button>
      <button class="fx-k-impj" title="从 JSON 文件导入（按 母厂+名称+Server+Title 去重合并）">导入</button>
    </div>
    <div class="fx-l-quickbox" style="display:none">
      <button data-sop="move" title="进入批量选择：勾选记录后统一移动到某个文件夹（搜索 / 文件夹视图可先过滤再全选，实现按条件批量归档）">${ic("batch")} 批量移动</button>
    </div>
    <div class="fx-k-folders"></div>
    <div class="fx-l-selbar" style="display:none"></div>
    <div class="fx-l-tablewrap fx-k-wrap"></div>`;
    renderKb(pane);
    pane.addEventListener("focusout", (e) => {
      const td = e.target.closest && e.target.closest("td[contenteditable][data-f]");
      if (!td) return;
      const arr = loadKb();
      const it = arr.find((x) => String(x.id) === td.closest("tr").dataset.id);
      if (!it) return;
      it[td.dataset.f] = td.innerText.replace(/\u00a0/g, " ").trim();
      saveKb(arr);
    });
    pane.querySelector(".fx-k-search").addEventListener("input", (e) => {
      pane.dataset.filter = e.target.value;
      renderKb(pane);
    });
    pane.addEventListener("click", (e) => {
      const fc = e.target.closest && e.target.closest(".fx-l-fchip");
      if (!fc) return;
      pane.dataset.folder = fc.dataset.fo || "";
      renderKb(pane);
    });
    pane.addEventListener("click", (e) => {
      if (e.target.closest(".fx-l-quickbtn")) {
        const qb = pane.querySelector(".fx-l-quickbox");
        if (qb) qb.style.display = qb.style.display === "none" ? "" : "none";
        return;
      }
      if (e.target.closest && e.target.closest('.fx-l-quickbox button[data-sop="move"]')) {
        const qb = pane.querySelector(".fx-l-quickbox");
        if (qb) qb.style.display = "none";
        pane.dataset.selecting = "1";
        renderKb(pane);
        importToast(`${ic("check")} 已进入批量选择：勾选记录后点「${ic("folder")} 移动到文件夹…」（搜索 / 文件夹视图可先过滤再全选）`);
        return;
      }
      if (e.target.closest(".fx-l-selexit")) {
        delete pane.dataset.selecting;
        renderKb(pane);
        return;
      }
      if (e.target.closest(".fx-l-selall")) {
        const boxes = Array.from(pane.querySelectorAll("td.fx-l-sel input"));
        const all = boxes.length && boxes.every((b) => b.checked);
        boxes.forEach((b) => {
          b.checked = !all;
        });
        updateSelBarCnt(pane);
        return;
      }
      if (e.target.closest(".fx-l-selmove")) {
        batchMoveSelected(pane, loadKb, saveKb, renderKb);
        return;
      }
    });
    pane.addEventListener("change", (e) => {
      if (e.target.closest && e.target.closest("td.fx-l-sel input")) updateSelBarCnt(pane);
    });
    pane.addEventListener("paste", (e) => {
      const cell = e.target.closest && e.target.closest(".fx-k-imgs");
      if (!cell) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      let got = false;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.type && it.type.indexOf("image/") === 0) {
          const blob = it.getAsFile();
          if (blob) {
            got = true;
            kbAddImage(pane, cell.closest("tr").dataset.id, blob);
          }
        }
      }
      if (got) e.preventDefault();
    });
    attachRowDrag(
      pane,
      (a, b) => {
        const arr = loadKb();
        const A = arr.find((x) => String(x.id) === a);
        const B = arr.find((x) => String(x.id) === b);
        return !!(A && B && String(A.parent || "") === String(B.parent || ""));
      },
      (id, targetId, before) => {
        const arr = loadKb();
        const drag = arr.find((x) => String(x.id) === id);
        if (!drag) {
          renderKb(pane);
          return;
        }
        const group = arr.filter((x) => String(x.parent || "") === String(drag.parent || "")).sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.name || "").localeCompare(String(b.name || ""), "zh"));
        group.splice(group.indexOf(drag), 1);
        const ti = group.findIndex((x) => String(x.id) === targetId);
        if (ti < 0) {
          renderKb(pane);
          return;
        }
        group.splice(before ? ti : ti + 1, 0, drag);
        group.forEach((g, i) => {
          g.order = i;
        });
        if (saveKb(arr)) renderKb(pane);
      }
    );
    pane.addEventListener("click", (e) => {
      const fb = e.target.closest && e.target.closest(".fx-l-filebtn");
      if (fb) {
        const arr = loadKb();
        const it = arr.find((x) => String(x.id) === fb.closest("tr").dataset.id);
        if (!it) return;
        const curView = pane.dataset.folder || "";
        const pre = curView && curView !== "*" ? curView : String(it.folder || "").trim();
        const name = window.prompt("归档到哪个文件夹？（输入名字=归档/移动到该文件夹；清空=移出文件夹）", pre);
        if (name === null) return;
        it.folder = name.trim();
        if (saveKb(arr)) renderKb(pane);
        importToast(it.folder ? `${ic("folder")} 已归档到「${esc(it.folder)}」` : `${ic("folder")} 已移出文件夹`);
        return;
      }
      const del = e.target.closest && e.target.closest(".fx-k-del");
      if (del) {
        saveKb(loadKb().filter((x) => String(x.id) !== del.closest("tr").dataset.id));
        renderKb(pane);
        return;
      }
      const imgdel = e.target.closest && e.target.closest(".fx-k-imgdel");
      if (imgdel) {
        const arr = loadKb();
        const it = arr.find((x) => String(x.id) === imgdel.closest("tr").dataset.id);
        if (it && it.images) {
          it.images.splice(+imgdel.dataset.i, 1);
          if (saveKb(arr)) renderKb(pane);
        }
        return;
      }
      const thumb = e.target.closest && e.target.closest(".fx-k-thumb");
      if (thumb) {
        const it = loadKb().find((x) => String(x.id) === thumb.closest("tr").dataset.id);
        if (it && it.images && it.images[+thumb.dataset.i]) kbLightbox(it.images[+thumb.dataset.i]);
        return;
      }
      const addimg = e.target.closest && e.target.closest(".fx-k-addimg");
      if (addimg) {
        const tr = addimg.closest("tr");
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = "image/*";
        inp.style.display = "none";
        inp.addEventListener("change", () => {
          const f = inp.files && inp.files[0];
          inp.remove();
          if (f) kbAddImage(pane, tr.dataset.id, f);
        });
        document.body.appendChild(inp);
        inp.click();
        return;
      }
      if (e.target.closest(".fx-k-add")) {
        const arr = loadKb();
        const it = newKbEntry();
        const fv = pane.dataset.folder || "";
        it.folder = fv && fv !== "*" ? fv : "";
        arr.push(it);
        saveKb(arr);
        const si = pane.querySelector(".fx-k-search");
        if (si) {
          si.value = "";
          pane.dataset.filter = "";
        }
        renderKb(pane);
        const cell = pane.querySelector(`tbody tr[data-id="${it.id}"] td[contenteditable]`);
        if (cell) {
          cell.focus();
          cell.scrollIntoView({ block: "nearest" });
        }
        return;
      }
      if (e.target.closest(".fx-k-expj")) {
        downloadFile("fofa-toolbox-kb.json", JSON.stringify(loadKb(), null, 2), "application/json");
        return;
      }
      if (e.target.closest(".fx-k-impj")) {
        kbImport(pane);
        return;
      }
    });
  }
  function doExport(kind) {
    const arr = loadLib();
    const run = (resolve) => {
      const data = resolve ? arr.map((it) => Object.assign({}, it, { query: resolveQuery(it.query, false) })) : arr;
      if (kind === "json") downloadFile("fofa-toolbox-fingerprints.json", JSON.stringify(data, null, 2), "application/json");
      else downloadFile("fofa-toolbox-fingerprints.csv", libToCsv(data), "text/csv");
    };
    if (arr.some((it) => hasBuiltinSyntax(it.query))) showExportChoice(run);
    else run(false);
  }
  function showExportChoice(run) {
    const old = document.getElementById("fofa-export-choice");
    if (old) old.remove();
    const dlg = document.createElement("div");
    dlg.id = "fofa-export-choice";
    dlg.innerHTML = `
    <div class="fx-e-title">导出选项</div>
    <div class="fx-e-text">检测到搜索语句使用了内置语法（YESTERDAY / LastMonth）。导出时如何处理？</div>
    <div class="fx-e-btns">
      <button class="fx-e-resolve">替换为实际日期后导出</button>
      <button class="fx-e-raw">直接导出（保留内置语法）</button>
      <button class="fx-e-cancel">取消</button>
    </div>`;
    dlg.addEventListener("click", (e) => {
      if (e.target.closest(".fx-e-resolve")) {
        dlg.remove();
        run(true);
      } else if (e.target.closest(".fx-e-raw")) {
        dlg.remove();
        run(false);
      } else if (e.target.closest(".fx-e-cancel")) dlg.remove();
    });
    document.documentElement.appendChild(dlg);
  }
  function parseImportJson(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("JSON 解析失败：" + e.message);
    }
    const arr = Array.isArray(data) ? data : data && Array.isArray(data.items) ? data.items : null;
    if (!arr) throw new Error("JSON 内容不是指纹库数组");
    return arr.filter((x) => x && typeof x === "object");
  }
  function parseImportCsv(text) {
    if (text.charCodeAt(0) === 65279) text = text.slice(1);
    const rows = [];
    let row = [], cell = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i++;
          } else inQ = false;
        } else cell += c;
      } else if (c === '"' && cell === "") inQ = true;
      else if (c === ",") {
        row.push(cell);
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else cell += c;
    }
    if (cell !== "" || row.length) {
      row.push(cell);
      if (row.length > 1 || row[0] !== "") rows.push(row);
    }
    if (rows.length < 2) throw new Error("CSV 中没有数据行");
    const keyOf = {};
    for (const f of LIB_FIELDS) {
      keyOf[f.label] = f.key;
      keyOf[f.key] = f.key;
    }
    keyOf["收藏时间"] = "ts";
    const head = rows[0].map((h) => keyOf[String(h).trim()] || null);
    if (!head.includes("query")) throw new Error("CSV 表头缺少「搜索语句」列");
    return rows.slice(1).map((r) => {
      const o = {};
      head.forEach((k, i) => {
        if (k) o[k] = r[i] == null ? "" : r[i];
      });
      return o;
    });
  }
  function parseImport(text, fname) {
    text = String(text).replace(/^\ufeff/, "").trim();
    if (!text) throw new Error("文件内容为空");
    const c0 = text.charCodeAt(0);
    const isJson = /\.json$/i.test(fname || "") || c0 === 91 || c0 === 123;
    return isJson ? parseImportJson(text) : parseImportCsv(text);
  }
  function mergeImport(raws, arr) {
    const ids = new Set(arr.map((x) => x.id));
    const key = (q) => String(q || "").replace(/\s+/g, "").trim();
    const seen = new Set(arr.map((x) => key(x.query)).filter(Boolean));
    const list = arr.slice();
    let added = 0, skipped = 0;
    for (const raw of raws) {
      const it = {};
      for (const f of LIB_FIELDS) it[f.key] = raw[f.key] == null ? "" : String(raw[f.key]).trim();
      it.ts = raw.ts == null ? "" : String(raw.ts).trim();
      it.pin = raw.pin === true;
      if (!LIB_FIELDS.some((f) => f.key !== "folder" && it[f.key])) continue;
      const k = key(it.query);
      if (!k || seen.has(k)) {
        skipped++;
        continue;
      }
      let id = Number(raw.id);
      if (!raw.id || !Number.isFinite(id) || ids.has(id)) {
        do {
          id = Date.now() + Math.floor(Math.random() * 1e6);
        } while (ids.has(id));
      }
      it.id = id;
      ids.add(id);
      seen.add(k);
      list.push(it);
      added++;
    }
    return { list, added, skipped };
  }
  function doImport(panel) {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,.csv,application/json,text/csv";
    inp.style.display = "none";
    inp.addEventListener("cancel", () => inp.remove());
    inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      readImportText(f, (text) => {
        if (text == null) {
          importToast(`${ic("warn")} 导入失败：文件读取错误`);
          return;
        }
        try {
          const res = mergeImport(parseImport(text, f.name), loadLib());
          saveLib(res.list);
          if (panel && panel.parentNode) renderLib(panel);
          importToast(`${ic("ok")} 导入完成：新增 <b>${res.added}</b> 条，跳过 <b>${res.skipped}</b> 条（语句为空或已存在）`);
        } catch (err) {
          importToast(`${ic("warn")} 导入失败：${esc(err.message)}`);
        }
      });
    });
    document.body.appendChild(inp);
    inp.click();
  }
  let libUndoSnap = null;
  const libRowUndo = /* @__PURE__ */ new Map();
  const FOLDER_FOLDED_KEY = "fofa-lib-folder-folded";
  let folderFolded = /* @__PURE__ */ new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(FOLDER_FOLDED_KEY) || "[]");
    if (Array.isArray(saved)) folderFolded = new Set(saved.map(String));
  } catch (e) {
  }
  function libFiltered(filter, folderView) {
    const kw = String(filter || "").trim().toLowerCase();
    const hit = (it) => inFolderView(it, folderView) && (!kw || LIB_FIELDS.some((f) => String(it[f.key] || "").toLowerCase().includes(kw)));
    return loadLib().filter(hit).slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0));
  }
  function renderLib(pane) {
    const arr = loadLib();
    if (!pane.querySelector(".fx-l-tablewrap")) {
      pane.innerHTML = `
    <div class="fx-l-tools">
      <input class="fx-l-libsearch" placeholder="搜索：名称 / 语句 / 产品 / 类型 / 国家 / 厂商 / 文件夹…" spellcheck="false" title="按任意列内容实时过滤（含文件夹名；置顶条目仍优先）">
      <span class="fx-l-count"></span>
      <button class="fx-l-add" title="新建条目：结果页会自动填写当前语句与排名信息，否则为空白；在某个文件夹视图里新建会自动归档进该文件夹">${ic("add")} 新建</button>
      <button class="fx-l-quickbtn" title="批量操作：整理全库语句（可撤销）/ 批量移动到文件夹等">${ic("quick")} 快速操作</button>
      <button class="fx-l-expj" title="导出为 JSON 文件">导出 JSON</button>
      <button class="fx-l-expc" title="导出为 CSV 文件（Excel 可直接打开）">导出 CSV</button>
      <button class="fx-l-imp" title="从本脚本导出的 JSON/CSV 文件导入（Excel 另存的 GBK 编码 CSV 也能识别）：按搜索语句去重，已存在的自动跳过">导入</button>
      <button class="fx-l-undo" style="display:none" title="恢复最近一次语句类快速操作（全库去重/删除地区等，不含批量移动）前的完整备份（会覆盖其后的修改）">${ic("undo")} 撤销</button>
    </div>
    <div class="fx-l-quickbox" style="display:none">
      <button data-op="dedup" title="对所有条目的语句执行去重瘦身：同字段只保留最后一条定位条件、丢弃中间排除与冗余分类；完成后可「撤销」">${ic("dedup")} 全库去重</button>
      <button data-op="dropcountry" title="去掉每条语句里全部 country 条件（或组/单条/排除都删，其他字段与原样片段不动）；完成后可「撤销」">${ic("globe")} 删除地区</button>
      <button data-sop="move" title="进入批量选择：勾选条目后统一移动到某个文件夹（搜索 / 文件夹视图可先过滤再全选，实现按条件批量归档）">${ic("batch")} 批量移动</button>
    </div>
    <div class="fx-l-folders"></div>
    <div class="fx-l-selbar" style="display:none"></div>
    <div class="fx-l-tablewrap"></div>`;
      const si = pane.querySelector(".fx-l-libsearch");
      if (si && pane.dataset.filter) si.value = pane.dataset.filter;
    }
    const kw = String(pane.dataset.filter || "").trim();
    const view = pane.dataset.folder || "";
    const folders = /* @__PURE__ */ new Map();
    for (const it of arr) {
      const f = String(it.folder || "").trim();
      if (f) folders.set(f, (folders.get(f) || 0) + 1);
    }
    const unfiled = arr.filter((it) => !String(it.folder || "").trim()).length;
    const chip = (fo, label, on) => `<button class="fx-l-fchip${on ? " on" : ""}" data-fo="${esc(fo)}">${label}</button>`;
    const fbar = pane.querySelector(".fx-l-folders");
    if (fbar) {
      fbar.innerHTML = chip("", `全部 (${arr.length})`, view === "") + chip("*", `未归档 (${unfiled})`, view === "*") + [...folders.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh")).map(([f, n]) => chip(f, `${ic("folder")} ${esc(f)} (${n})`, view === f)).join("");
      fbar.style.display = folders.size || view === "*" ? "" : "none";
    }
    const sorted = libFiltered(pane.dataset.filter, view);
    const cols = LIB_FIELDS.filter((f) => f.key !== "folder");
    const groups = view === "" ? groupList(sorted, (it) => it.folder) : [{ group: "", items: sorted }];
    const showHeads = view === "" && (groups.length > 1 || groups.some((g) => g.group));
    const selecting = pane.dataset.selecting === "1";
    const lead = selecting ? (it) => `<td class="fx-l-sel"><input type="checkbox" title="选中以批量移动"></td>` : () => `<td class="fx-rowdrag" draggable="true" title="拖动调整顺序（同文件夹、同置顶状态内）">${ic("drag")}</td>`;
    const rowOf = (it) => `<tr data-id="${it.id}"${it.pin ? ' class="fx-l-userpin"' : ""}>${lead()}${cols.map(
    (f) => `<td${f.mono ? ' class="fx-l-mono"' : ""} data-f="${f.key}" contenteditable="true" spellcheck="false">${esc(it[f.key] || "")}</td>`
  ).join("")}<td class="fx-l-ops"><b class="fx-l-filebtn" title="归档到文件夹：输入名字归档/移动，清空则移出文件夹">${ic("folder")}</b><b class="fx-l-pinbtn${it.pin ? " on" : ""}" title="${it.pin ? "取消置顶" : "置顶"}">${ic("pin")}</b><b class="fx-l-toedit" title="把此语句发送到查询编辑器继续编辑（编辑器将脱离页面语句跟随）">${ic("edit")}</b><b class="fx-l-search" title="用此语句搜索（YESTERDAY/LastMonth 自动替换为日期）">${ic("search")}</b><b class="fx-l-cal" title="把 after 日期替换为一月前再搜索">${ic("time")}</b><b class="fx-l-dedup" title="语句去重瘦身：同字段只保留最后一条定位条件、丢弃中间排除与冗余分类；可撤销">${ic("dedup")}</b>${libRowUndo.has(String(it.id)) ? `<b class="fx-l-undorow" title="撤销本行去重，恢复原语句（会覆盖其后对此语句的修改）">${ic("undo")}</b>` : ""}<b class="fx-l-del" title="删除此条">${ic("del")}</b></td></tr>`;
    let rows = "";
    for (const g of groups) {
      const folded = !kw && showHeads && folderFolded.has(g.group || "");
      if (showHeads) rows += `<tr class="fx-l-ghead" data-fog="${esc(g.group || "")}" title="${folded ? "展开" : "收起"}该文件夹"><td colspan="${cols.length + 2}">${ic(folded ? "folderExpand" : "folderCollapse")} ${ic("folder")} ${esc(g.group || "未归档")}<span>${g.items.length}</span></td></tr>`;
      if (folded) continue;
      rows += g.items.map(rowOf).join("");
    }
    pane.querySelector(".fx-l-tablewrap").innerHTML = `<table class="fx-l-table">
      <thead><tr><th style="width:26px"></th>${cols.map((f) => `<th style="width:${f.w}">${f.label}</th>`).join("")}<th>操作</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="${cols.length + 2}" class="fx-l-empty">${kw ? `没有匹配的条目：换个关键词，或清空搜索框显示全部 ${arr.length} 条` : view ? `此视图暂无条目：点「${ic("add")} 新建」新建（会归入当前文件夹），或在其他视图用行内 ${ic("folder")} 归档进来` : `暂无收藏条目：点「${ic("add")} 新建」即可收藏当前语句（结果页自动填写），或手动添加`}</td></tr>`}</tbody>
    </table>`;
    const cnt = pane.querySelector(".fx-l-count");
    if (cnt) cnt.textContent = kw ? `共 ${arr.length} 条，匹配 ${sorted.length} 条` : `共 ${arr.length} 条`;
    const ub = pane.querySelector(".fx-l-undo");
    if (ub) ub.style.display = libUndoSnap ? "" : "none";
    updateSelBar(pane);
  }
  function attachLibEvents(pane) {
    pane.addEventListener("focusout", (e) => {
      const td = e.target.closest && e.target.closest("td[contenteditable][data-f]");
      if (!td) return;
      const tr = td.closest("tr");
      const arr2 = loadLib();
      const it = arr2.find((x) => String(x.id) === tr.dataset.id);
      if (!it) return;
      it[td.dataset.f] = td.innerText.replace(/\u00a0/g, " ").trim();
      saveLib(arr2);
    });
    pane.addEventListener("input", (e) => {
      const si = e.target.closest && e.target.closest(".fx-l-libsearch");
      if (!si) return;
      pane.dataset.filter = si.value;
      renderLib(pane);
    });
    pane.addEventListener("click", (e) => {
      const fc = e.target.closest && e.target.closest(".fx-l-fchip");
      if (!fc) return;
      pane.dataset.folder = fc.dataset.fo || "";
      renderLib(pane);
    });
    pane.addEventListener("change", (e) => {
      if (e.target.closest && e.target.closest("td.fx-l-sel input")) updateSelBarCnt(pane);
    });
    attachRowDrag(
      pane,
      (a, b) => {
        const arr2 = loadLib();
        const A = arr2.find((x) => String(x.id) === a);
        const B = arr2.find((x) => String(x.id) === b);
        return !!(A && B && (A.pin ? 1 : 0) === (B.pin ? 1 : 0) && String(A.folder || "") === String(B.folder || ""));
      },
      (id, targetId, before) => {
        const arr2 = loadLib();
        const drag = arr2.find((x) => String(x.id) === id);
        if (!drag) {
          renderLib(pane);
          return;
        }
        arr2.splice(arr2.indexOf(drag), 1);
        const ti = arr2.findIndex((x) => String(x.id) === targetId);
        if (ti < 0) {
          renderLib(pane);
          return;
        }
        arr2.splice(before ? ti : ti + 1, 0, drag);
        saveLib(arr2);
        renderLib(pane);
      }
    );
    pane.addEventListener("click", (e) => {
      const ghead = e.target.closest && e.target.closest("tr.fx-l-ghead");
      if (ghead) {
        const name = ghead.dataset.fog || "";
        if (folderFolded.has(name)) folderFolded.delete(name);
        else folderFolded.add(name);
        try {
          localStorage.setItem(FOLDER_FOLDED_KEY, JSON.stringify([...folderFolded]));
        } catch (err) {
        }
        renderLib(pane);
        return;
      }
      const del = e.target.closest && e.target.closest(".fx-l-del");
      if (del) {
        const id = del.closest("tr").dataset.id;
        saveLib(loadLib().filter((x) => String(x.id) !== id));
        renderLib(pane);
        return;
      }
      const dd = e.target.closest && e.target.closest(".fx-l-dedup");
      if (dd) {
        const arr2 = loadLib();
        const it = arr2.find((x) => String(x.id) === dd.closest("tr").dataset.id);
        if (!it || !it.query) return;
        const before = String(it.query).trim();
        const q2 = dedupeQuery(before);
        if (q2 === before) {
          importToast("此条语句没有可去重的内容");
          return;
        }
        libRowUndo.set(String(it.id), before);
        it.query = q2;
        saveLib(arr2);
        renderLib(pane);
        importToast(`${ic("ok")} 已去重（${before.length} 字 → <b>${q2.length}</b> 字），失误可点该行的 ↩`);
        return;
      }
      const undorow = e.target.closest && e.target.closest(".fx-l-undorow");
      if (undorow) {
        const id = undorow.closest("tr").dataset.id;
        const before = libRowUndo.get(String(id));
        const arr2 = loadLib();
        const it = arr2.find((x) => String(x.id) === id);
        if (it && before != null) {
          it.query = before;
          saveLib(arr2);
        }
        libRowUndo.delete(String(id));
        renderLib(pane);
        importToast(`${ic("undo")} 已恢复本行去重前的语句`);
        return;
      }
      if (e.target.closest(".fx-l-quickbtn")) {
        const qb = pane.querySelector(".fx-l-quickbox");
        if (qb) qb.style.display = qb.style.display === "none" ? "" : "none";
        return;
      }
      if (e.target.closest && e.target.closest('.fx-l-quickbox button[data-sop="move"]')) {
        const qb = pane.querySelector(".fx-l-quickbox");
        if (qb) qb.style.display = "none";
        pane.dataset.selecting = "1";
        renderLib(pane);
        importToast(`${ic("check")} 已进入批量选择：勾选条目后点「${ic("folder")} 移动到文件夹…」（搜索 / 文件夹视图可先过滤再全选）`);
        return;
      }
      if (e.target.closest(".fx-l-selexit")) {
        delete pane.dataset.selecting;
        renderLib(pane);
        return;
      }
      if (e.target.closest(".fx-l-selall")) {
        const boxes = Array.from(pane.querySelectorAll("td.fx-l-sel input"));
        const all = boxes.length && boxes.every((b) => b.checked);
        boxes.forEach((b) => {
          b.checked = !all;
        });
        updateSelBarCnt(pane);
        return;
      }
      if (e.target.closest(".fx-l-selmove")) {
        batchMoveSelected(pane, loadLib, saveLib, renderLib);
        return;
      }
      const qop = e.target.closest && e.target.closest(".fx-l-quickbox button[data-op]");
      if (qop) {
        const op = LIB_QUICK_OPS[qop.dataset.op];
        const qb = pane.querySelector(".fx-l-quickbox");
        if (qb) qb.style.display = "none";
        if (op) libApplyQueryOp(pane, op.fn, op.label);
        return;
      }
      const toedit = e.target.closest && e.target.closest(".fx-l-toedit");
      if (toedit) {
        const it2 = loadLib().find((x) => String(x.id) === toedit.closest("tr").dataset.id);
        if (it2 && it2.query && editMain) {
          editMain.loadQuery(it2.query);
          switchTab("edit");
          importToast(`${ic("ok")} 已载入查询编辑器（不再跟随页面语句，「${ic("refresh")} 使用当前查询语句」可切回）`);
        } else if (!it2 || !it2.query) importToast(`${ic("warn")} 此条没有搜索语句`);
        return;
      }
      if (e.target.closest(".fx-l-undo")) {
        if (!libUndoSnap) return;
        saveLib(libUndoSnap);
        libUndoSnap = null;
        renderLib(pane);
        importToast(`${ic("undo")} 已恢复去重前的指纹库`);
        return;
      }
      const fb = e.target.closest && e.target.closest(".fx-l-filebtn");
      if (fb) {
        const arr2 = loadLib();
        const it2 = arr2.find((x) => String(x.id) === fb.closest("tr").dataset.id);
        if (!it2) return;
        const curView = pane.dataset.folder || "";
        const pre = curView && curView !== "*" ? curView : String(it2.folder || "").trim();
        const name = window.prompt("归档到哪个文件夹？（输入名字=归档/移动到该文件夹；清空=移出文件夹）", pre);
        if (name === null) return;
        it2.folder = name.trim();
        saveLib(arr2);
        renderLib(pane);
        importToast(it2.folder ? `${ic("folder")} 已归档到「${esc(it2.folder)}」` : `${ic("folder")} 已移出文件夹`);
        return;
      }
      const pinBtn = e.target.closest && e.target.closest(".fx-l-pinbtn");
      if (pinBtn) {
        const id = pinBtn.closest("tr").dataset.id;
        const arr2 = loadLib();
        const it = arr2.find((x) => String(x.id) === id);
        if (it) {
          it.pin = !it.pin;
          saveLib(arr2);
        }
        renderLib(pane);
        return;
      }
      const cal = e.target.closest && e.target.closest(".fx-l-cal");
      if (cal) {
        const q = (loadLib().find((x) => String(x.id) === cal.closest("tr").dataset.id) || {}).query || "";
        if (q) openTab(resolveQuery(q, true));
        return;
      }
      const search = e.target.closest && e.target.closest(".fx-l-search");
      if (search) {
        const q = (loadLib().find((x) => String(x.id) === search.closest("tr").dataset.id) || {}).query || "";
        if (q) openTab(resolveQuery(q, false));
        return;
      }
      if (e.target.closest(".fx-l-add")) {
        const arr2 = loadLib();
        const entry = captureFingerprint() || (() => {
          const blank = { id: Date.now(), ts: (/* @__PURE__ */ new Date()).toLocaleString() };
          for (const f of LIB_FIELDS) blank[f.key] = "";
          return blank;
        })();
        const fv = pane.dataset.folder || "";
        entry.folder = fv && fv !== "*" ? fv : "";
        arr2.unshift(entry);
        saveLib(arr2);
        const si = pane.querySelector(".fx-l-libsearch");
        if (si) {
          si.value = "";
          pane.dataset.filter = "";
        }
        renderLib(pane);
        const cell = pane.querySelector(`tbody tr[data-id="${entry.id}"] td[contenteditable]`);
        if (cell) {
          cell.focus();
          cell.scrollIntoView({ block: "nearest" });
        }
        return;
      }
      if (e.target.closest(".fx-l-expj")) {
        doExport("json");
        return;
      }
      if (e.target.closest(".fx-l-expc")) {
        doExport("csv");
        return;
      }
      if (e.target.closest(".fx-l-imp")) {
        doImport(pane);
        return;
      }
    });
  }
  function libApplyQueryOp(pane, fn, label) {
    const arr = loadLib();
    const snap = JSON.parse(JSON.stringify(arr));
    let changed = 0;
    for (const it of arr) {
      if (!it.query) continue;
      const before = String(it.query).trim();
      const q2 = fn(before);
      if (q2 !== before) {
        it.query = q2;
        changed++;
      }
    }
    libUndoSnap = changed ? snap : null;
    saveLib(arr);
    renderLib(pane);
    importToast(changed ? `${ic("ok")} ${label}完成：<b>${changed}</b> 条语句被修改，失误可点「${ic("undo")} 撤销」` : `${label}：全库没有可修改的内容`);
  }
  function hideStagePanel() {
    const p = document.getElementById("fofa-toolbox-stage-panel");
    if (p) p.remove();
  }
  function ensureStagedBar() {
    const n = loadStaged().length;
    let bar = document.getElementById("fofa-toolbox-stage-bar");
    if (!n) {
      if (bar) bar.remove();
      hideStagePanel();
      return;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "fofa-toolbox-stage-bar";
      bar.title = "已暂存的条件，点击批量排除/包含（也可并入查询编辑器）";
      bar.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = document.getElementById("fofa-toolbox-stage-panel");
        if (p) hideStagePanel();
        else showStagePanel();
      });
      document.documentElement.appendChild(bar);
    }
    bar.innerHTML = ic("batch") + " " + n;
  }
  function showStagePanel() {
    hideStagePanel();
    injectStyle();
    const arr = loadStaged();
    const panel = document.createElement("div");
    panel.id = "fofa-toolbox-stage-panel";
    panel.innerHTML = `
    <div class="fx-p-title">已暂存 ${arr.length} 个条件（排除时已存在于当前语句的会被就地取反；也可并入查询编辑器继续编辑）</div>
    <div class="fx-p-list">${arr.map(
    (c, i) => `<div class="fx-p-item"><span title="${esc(c)}">${esc(c)}</span><b data-i="${i}" title="移除">×</b></div>`
  ).join("")}</div>
    <div class="fx-p-btns">
      <button class="fx-p-primary" title="把全部暂存条件取反后并入当前语句并打开">${ic("exclude")} 全部排除并打开</button>
      <button class="fx-p-inc" title="把全部暂存条件并入当前语句并打开（同字段多值自动用 || 并列加括号）">${ic("include")} 全部包含</button>
      <button class="fx-p-eexclude" title="把全部暂存条件取反后作为字段卡并入查询编辑器：同字段自动集中一卡、去重；工具箱没开会自动打开，不新开标签">${ic("exclude")}${ic("edit")} 排除到编辑器</button>
      <button class="fx-p-einclude" title="把全部暂存条件作为字段卡并入查询编辑器：同字段多值自动并列成或卡（加括号）、去重；工具箱没开会自动打开，不新开标签">${ic("include")}${ic("edit")} 包含到编辑器</button>
      <button class="fx-p-clear" title="清空暂存">清空</button>
    </div>`;
    panel.addEventListener("click", (e) => {
      const rm = e.target.closest && e.target.closest(".fx-p-item b");
      if (rm) {
        const a = loadStaged();
        a.splice(Number(rm.dataset.i), 1);
        saveStaged(a);
        ensureStagedBar();
        if (a.length) showStagePanel();
        else hideStagePanel();
        return;
      }
      const apply = (mode) => {
        const q = applyBatch(currentQuery(), loadStaged(), mode);
        saveStaged([]);
        ensureStagedBar();
        hideStagePanel();
        if (q) openTab(q);
      };
      const toEditor = (mode) => {
        const conds = loadStaged();
        editorAppend(conds, mode);
        saveStaged([]);
        ensureStagedBar();
        hideStagePanel();
      };
      if (e.target.closest(".fx-p-primary")) apply("exclude");
      else if (e.target.closest(".fx-p-inc")) apply("include");
      else if (e.target.closest(".fx-p-eexclude")) toEditor("exclude");
      else if (e.target.closest(".fx-p-einclude")) toEditor("include");
      else if (e.target.closest(".fx-p-clear")) {
        saveStaged([]);
        ensureStagedBar();
      }
    });
    document.documentElement.appendChild(panel);
  }
  function initStage() {
    setInterval(ensureStagedBar, 2e3);
    ensureStagedBar();
  }
  const b64enc = (s) => btoa(String.fromCharCode.apply(null, new TextEncoder().encode(s)));
  const b64dec = (s) => {
    s = String(s).trim().replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return new TextDecoder("utf-8").decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  };
  function queryFromUrl(url) {
    try {
      const search = new URL(url, location.origin).search;
      const m = /[?&]qbase64=([^&]+)/.exec(search);
      if (!m) return null;
      return b64dec(decodeURIComponent(m[1])).trim();
    } catch (e) {
      return null;
    }
  }
  let rubber = null;
  let swallowClickUntil = 0;
  function intersects(el, R) {
    const r = el.getBoundingClientRect();
    return r.left < R.r && r.right > R.l && r.top < R.b && r.bottom > R.t;
  }
  function collectInRect(R) {
    const cur = currentQuery();
    const out = [];
    const push = (c) => {
      c = String(c || "").replace(/\s+/g, " ").trim();
      if (!c || out.includes(c)) return;
      if (c.includes('="-"') || c.includes('=="-"')) return;
      out.push(c);
    };
    for (const a of document.querySelectorAll('.hsxa-meta-data-statistical-list a[href*="qbase64="]')) {
      if (!intersects(a, R)) continue;
      const lq = queryFromUrl(a.href);
      if (!lq) continue;
      const cond = extractNew(lq, cur) || selfCondition(lq, firstText(a));
      if (cond) push(ensurePos(cond));
    }
    for (const img of document.querySelectorAll("img.el-image__inner")) {
      if (!intersects(img, R)) continue;
      const link = img.closest('a[href*="qbase64="]');
      if (!link) continue;
      const lq = queryFromUrl(link.href);
      if (!lq) continue;
      const cond = extractNew(lq, cur) || selfCondition(lq, firstText(link));
      if (cond) push(ensurePos(cond));
    }
    for (const img of document.querySelectorAll("img.hsxa-country-img")) {
      if (intersects(img, R)) {
        const c = countryFromFlag(img);
        if (c) push(ensurePos(c));
      }
    }
    for (const sp of document.querySelectorAll("span.hsxa-server-icon")) {
      if (intersects(sp, R)) {
        const c = serverFromIcon(sp);
        if (c) push(ensurePos(c));
      }
    }
    for (const img of document.querySelectorAll(".icon_hash-icon-list img")) {
      if (intersects(img, R)) {
        const c = iconFromSidebar(img);
        if (c) push(ensurePos(c));
      }
    }
    return out;
  }
  function rubberStop(cancelled) {
    const r = rubber;
    rubber = null;
    const ov = document.getElementById("fofa-toolbox-rubber");
    if (ov) ov.remove();
    document.documentElement.style.userSelect = "";
    if (!r || cancelled || !r.engaged || !r.rect) return null;
    swallowClickUntil = Date.now() + 350;
    return r.rect;
  }
  function initRubber() {
    document.addEventListener("mousedown", (e) => {
      if (!e.altKey || e.button !== 0) return;
      if (menu && menu.contains(e.target) || e.target.closest && e.target.closest("#fofa-toolbox-stage-bar,#fofa-toolbox-stage-panel")) return;
      rubber = { x: e.clientX, y: e.clientY, engaged: false };
    }, true);
    document.addEventListener("mousemove", (e) => {
      if (!rubber) return;
      if (!rubber.engaged && Math.abs(e.clientX - rubber.x) < 6 && Math.abs(e.clientY - rubber.y) < 6) return;
      if (!rubber.engaged) {
        rubber.engaged = true;
        const ov = document.createElement("div");
        ov.id = "fofa-toolbox-rubber";
        document.documentElement.appendChild(ov);
        document.documentElement.style.userSelect = "none";
        rubber.overlay = ov;
      }
      e.preventDefault();
      const l = Math.min(rubber.x, e.clientX), t = Math.min(rubber.y, e.clientY);
      const w = Math.abs(e.clientX - rubber.x), h = Math.abs(e.clientY - rubber.y);
      Object.assign(rubber.overlay.style, { left: l + "px", top: t + "px", width: w + "px", height: h + "px" });
      rubber.rect = { l, t, r: l + w, b: t + h };
    }, true);
    document.addEventListener("mouseup", (e) => {
      if (!rubber) return;
      const rect = rubberStop(false);
      if (!rect) return;
      const hits = collectInRect(rect);
      if (!hits.length) return;
      const arr = loadStaged();
      for (const c of hits) if (!arr.includes(c)) arr.push(c);
      saveStaged(arr);
      ensureStagedBar();
      showStagePanel();
    }, true);
    document.addEventListener("click", (e) => {
      if (Date.now() < swallowClickUntil) {
        swallowClickUntil = 0;
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }
  const ICON_CSS = `
@font-face{font-family:'fx-icons';src:url('/assets/font/iconfont.woff2?t=1766658209332') format('woff2');font-display:block}
.fx-ic{font-family:'fx-icons'!important;font-style:normal;speak:none;display:inline-block;vertical-align:-.15em;line-height:1;font-size:1.08em;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.fx-fb{display:none}
html.fx-icons-off .fx-ic{display:none}
html.fx-icons-off .fx-fb{display:inline}
.fx-ic-API:before{content:"\\e600"}.fx-ic-API3:before{content:"\\e64c"}.fx-ic-Copy__easyiconnet:before{content:"\\e63b"}.fx-ic-DVP:before{content:"\\e6cd"}.fx-ic-FOFAtubiao-02:before{content:"\\e652"}.fx-ic-FOFAtubiao_huaban1:before{content:"\\e651"}.fx-ic-Fdian-01:before{content:"\\e763"}.fx-ic-Gc_65_line-BatchProcessing:before{content:"\\e671"}.fx-ic-ICP:before{content:"\\e655"}.fx-ic-Linux:before{content:"\\e72f"}.fx-ic-NMStubiao-:before{content:"\\e621"}.fx-ic-RobotOutline:before{content:"\\e688"}.fx-ic-Traceability-01:before{content:"\\e746"}.fx-ic-UIsheji_menjinxitong-13:before{content:"\\e670"}.fx-ic-a-1:before{content:"\\e741"}.fx-ic-a-1-01:before{content:"\\e762"}.fx-ic-a-2:before{content:"\\e743"}.fx-ic-a-2-01:before{content:"\\e761"}.fx-ic-a-3:before{content:"\\e744"}.fx-ic-a-3-01:before{content:"\\e760"}.fx-ic-a-4:before{content:"\\e745"}.fx-ic-a-5:before{content:"\\e742"}.fx-ic-a-IP-01:before{content:"\\e751"}.fx-ic-a-IP-011:before{content:"\\e752"}.fx-ic-a-fenxiang1:before{content:"\\e664"}.fx-ic-a-qingzhu:before{content:"\\e6b0"}.fx-ic-a-xiaoping1:before{content:"\\e6f6"}.fx-ic-all:before{content:"\\e645"}.fx-ic-api-01:before{content:"\\e759"}.fx-ic-back-:before{content:"\\e690"}.fx-ic-baocun:before{content:"\\e6a7"}.fx-ic-batch:before{content:"\\e62c"}.fx-ic-bianji:before{content:"\\e64b"}.fx-ic-bianji-:before{content:"\\e696"}.fx-ic-bianji_pf-:before{content:"\\e69a"}.fx-ic-bianjimian:before{content:"\\e667"}.fx-ic-bianjisekuai:before{content:"\\ec7c"}.fx-ic-bingzhuangtu:before{content:"\\e620"}.fx-ic-bofang:before{content:"\\e62a"}.fx-ic-chakan:before{content:"\\e60a"}.fx-ic-chamore-01:before{content:"\\e740"}.fx-ic-chanpin:before{content:"\\e67c"}.fx-ic-chaxuncopy:before{content:"\\e705"}.fx-ic-chaxunyufa-01:before{content:"\\e702"}.fx-ic-chazhao-01:before{content:"\\e703"}.fx-ic-chengchangnengli:before{content:"\\e65b"}.fx-ic-cloud:before{content:"\\e7d9"}.fx-ic-convenient-efficient:before{content:"\\e6a0"}.fx-ic-copy:before{content:"\\e94c"}.fx-ic-cuo:before{content:"\\e63f"}.fx-ic-cuowutubiao:before{content:"\\e69c"}.fx-ic-daima:before{content:"\\e636"}.fx-ic-daping-01:before{content:"\\e767"}.fx-ic-dapingjiantou-01:before{content:"\\e766"}.fx-ic-define-future:before{content:"\\e6a1"}.fx-ic-dianhua:before{content:"\\e612"}.fx-ic-diannao:before{content:"\\e61e"}.fx-ic-dingyueshujurukou-01:before{content:"\\e753"}.fx-ic-diqiu:before{content:"\\e60b"}.fx-ic-down-01:before{content:"\\e74e"}.fx-ic-down-011:before{content:"\\e75f"}.fx-ic-drap-01:before{content:"\\e73b"}.fx-ic-dui:before{content:"\\e650"}.fx-ic-duihao:before{content:"\\e646"}.fx-ic-duihao2:before{content:"\\e6a9"}.fx-ic-email-fill:before{content:"\\e77e"}.fx-ic-encn-01:before{content:"\\e735"}.fx-ic-eye-close:before{content:"\\e60d"}.fx-ic-fenxiang:before{content:"\\e717"}.fx-ic-filter-full:before{content:"\\ea20"}.fx-ic-fuzhi:before{content:"\\e631"}.fx-ic-google:before{content:"\\ea0c"}.fx-ic-guanbi:before{content:"\\e60e"}.fx-ic-guanbi-:before{content:"\\e695"}.fx-ic-guanbi-01:before{content:"\\e70f"}.fx-ic-guanbi2fill:before{content:"\\e724"}.fx-ic-guanlishitu:before{content:"\\e6a8"}.fx-ic-guanyuwomen--:before{content:"\\e691"}.fx-ic-guanyuwomen---:before{content:"\\e692"}.fx-ic-guanyuwomen---1:before{content:"\\e693"}.fx-ic-guanyuwomen---2:before{content:"\\e694"}.fx-ic-guide:before{content:"\\e605"}.fx-ic-guize:before{content:"\\e66a"}.fx-ic-help:before{content:"\\e64d"}.fx-ic-honey-01:before{content:"\\e74a"}.fx-ic-hotpoc-01:before{content:"\\e749"}.fx-ic-huanfu:before{content:"\\e66e"}.fx-ic-huiche-01:before{content:"\\e6ff"}.fx-ic-huidingbu-:before{content:"\\e69b"}.fx-ic-huiyuan:before{content:"\\e60f"}.fx-ic-huiyuan1:before{content:"\\e8b1"}.fx-ic-huo:before{content:"\\e609"}.fx-ic-ico-file-format-variant:before{content:"\\e64e"}.fx-ic-icon:before{content:"\\e654"}.fx-ic-icon-:before{content:"\\e601"}.fx-ic-icon-invalid:before{content:"\\e74f"}.fx-ic-icon-shouqi:before{content:"\\e63c"}.fx-ic-icon-zhankai:before{content:"\\e63d"}.fx-ic-icon_download_state1:before{content:"\\e658"}.fx-ic-icon_honeypotcluster:before{content:"\\e6d5"}.fx-ic-icon_iptag_state1:before{content:"\\e65a"}.fx-ic-icon_tuoxian_state0:before{content:"\\e659"}.fx-ic-iconfonttishi:before{content:"\\e615"}.fx-ic-iconfontzhizuobiaozhun023146:before{content:"\\e6a6"}.fx-ic-information:before{content:"\\e640"}.fx-ic-ip-fill:before{content:"\\e9ed"}.fx-ic-ippilinag-01:before{content:"\\e6fe"}.fx-ic-jiahao:before{content:"\\e726"}.fx-ic-jiahao1:before{content:"\\e613"}.fx-ic-jiahaozhankai:before{content:"\\e647"}.fx-ic-jianhao:before{content:"\\e617"}.fx-ic-jiantou:before{content:"\\e62d"}.fx-ic-jiantou-:before{content:"\\e697"}.fx-ic-jiantou-01:before{content:"\\e73d"}.fx-ic-jiantouxia-:before{content:"\\e699"}.fx-ic-jinggao:before{content:"\\e84f"}.fx-ic-jinhangzhong:before{content:"\\e663"}.fx-ic-jishukong:before{content:"\\e69f"}.fx-ic-jishuwenti-:before{content:"\\e698"}.fx-ic-joint-scenario:before{content:"\\e6a4"}.fx-ic-kaiye:before{content:"\\e653"}.fx-ic-kucunguanli2:before{content:"\\e6af"}.fx-ic-kulou:before{content:"\\e657"}.fx-ic-liebiao:before{content:"\\e629"}.fx-ic-liebiao1:before{content:"\\e672"}.fx-ic-link:before{content:"\\e63a"}.fx-ic-linux:before{content:"\\e68a"}.fx-ic-lishi:before{content:"\\e6c8"}.fx-ic-lishijilu:before{content:"\\e778"}.fx-ic-lishijilu1:before{content:"\\e66f"}.fx-ic-lishijilu2:before{content:"\\e6f9"}.fx-ic-lishijilu__filled:before{content:"\\e61b"}.fx-ic-list-01:before{content:"\\e74c"}.fx-ic-list-011:before{content:"\\e75e"}.fx-ic-list-left-:before{content:"\\e68f"}.fx-ic-list-rich:before{content:"\\e633"}.fx-ic-list-right-:before{content:"\\e68e"}.fx-ic-list1-01:before{content:"\\e739"}.fx-ic-list2-01:before{content:"\\e73a"}.fx-ic-liwu:before{content:"\\e6cb"}.fx-ic-loudonggongbu:before{content:"\\e65e"}.fx-ic-masaike1:before{content:"\\e6b8"}.fx-ic-ok_y:before{content:"\\e656"}.fx-ic-paixu-01:before{content:"\\e701"}.fx-ic-piliang-01:before{content:"\\e75d"}.fx-ic-pingguo:before{content:"\\e606"}.fx-ic-podium:before{content:"\\e8c2"}.fx-ic-protocolrule-01:before{content:"\\e747"}.fx-ic-qingzhu:before{content:"\\e677"}.fx-ic-qita:before{content:"\\e65c"}.fx-ic-quanping:before{content:"\\e635"}.fx-ic-quanping-01:before{content:"\\e6fd"}.fx-ic-quanpingguanbi-01:before{content:"\\e6fc"}.fx-ic-renshu:before{content:"\\e642"}.fx-ic-renwu1-01:before{content:"\\e704"}.fx-ic-renwu2-01:before{content:"\\e70c"}.fx-ic-renwu3-01:before{content:"\\e70d"}.fx-ic-renwu4-01:before{content:"\\e707"}.fx-ic-renwu5-01:before{content:"\\e709"}.fx-ic-renwu6-01:before{content:"\\e706"}.fx-ic-renwu7-01:before{content:"\\e70b"}.fx-ic-renwu8-01:before{content:"\\e708"}.fx-ic-renwu9-01:before{content:"\\e70a"}.fx-ic-right:before{content:"\\e68b"}.fx-ic-sanjiaoright:before{content:"\\e6b7"}.fx-ic-saomiao:before{content:"\\e641"}.fx-ic-scanpoc-01:before{content:"\\e748"}.fx-ic-search:before{content:"\\e64f"}.fx-ic-search-copy:before{content:"\\e850"}.fx-ic-shaixuan:before{content:"\\e65d"}.fx-ic-shaixuan2:before{content:"\\e661"}.fx-ic-shanchu:before{content:"\\e626"}.fx-ic-shanchu1:before{content:"\\e628"}.fx-ic-shang:before{content:"\\e608"}.fx-ic-shangxiatuodong:before{content:"\\e675"}.fx-ic-shijian:before{content:"\\e61c"}.fx-ic-shoucang:before{content:"\\e62f"}.fx-ic-shouchang-01:before{content:"\\e75b"}.fx-ic-shuaxin:before{content:"\\e638"}.fx-ic-shuju-01:before{content:"\\e764"}.fx-ic-signtx-01:before{content:"\\e74d"}.fx-ic-softzsj-01:before{content:"\\e750"}.fx-ic-sousuo:before{content:"\\e66c"}.fx-ic-started-quickly:before{content:"\\e6a3"}.fx-ic-success:before{content:"\\e604"}.fx-ic-suo:before{content:"\\e627"}.fx-ic-suoding:before{content:"\\e8d4"}.fx-ic-suoding1:before{content:"\\e649"}.fx-ic-tianjia:before{content:"\\e622"}.fx-ic-tianjia1:before{content:"\\e62b"}.fx-ic-tiaozhuan:before{content:"\\e665"}.fx-ic-time:before{content:"\\e62e"}.fx-ic-time-:before{content:"\\e6a2"}.fx-ic-tishi:before{content:"\\e69e"}.fx-ic-tongji-01:before{content:"\\e75c"}.fx-ic-tubiao:before{content:"\\e634"}.fx-ic-tuichu:before{content:"\\e7ed"}.fx-ic-tuichu-01:before{content:"\\e74b"}.fx-ic-tuozhan:before{content:"\\e610"}.fx-ic-twitter-fill:before{content:"\\e6c1"}.fx-ic-weixin:before{content:"\\e603"}.fx-ic-weixin1:before{content:"\\e619"}.fx-ic-wenhao:before{content:"\\e614"}.fx-ic-wenhao1:before{content:"\\e64a"}.fx-ic-wenti:before{content:"\\e607"}.fx-ic-window:before{content:"\\e70e"}.fx-ic-wode:before{content:"\\e61f"}.fx-ic-wufengpinjie-dianji:before{content:"\\e666"}.fx-ic-wuxiaoguo:before{content:"\\e673"}.fx-ic-xia:before{content:"\\e624"}.fx-ic-xia1:before{content:"\\e644"}.fx-ic-xiafarenwu-01:before{content:"\\e765"}.fx-ic-xialajiantou_huaban:before{content:"\\e623"}.fx-ic-xiansuo:before{content:"\\78"}.fx-ic-xiaoxi:before{content:"\\e625"}.fx-ic-xiazai:before{content:"\\e630"}.fx-ic-xingzhuang:before{content:"\\e63e"}.fx-ic-xuexiyufa:before{content:"\\e61a"}.fx-ic-yanjing:before{content:"\\e602"}.fx-ic-yanjing-bi:before{content:"\\e61d"}.fx-ic-yanzheng-01:before{content:"\\e700"}.fx-ic-yingyong:before{content:"\\e637"}.fx-ic-yinhangqia:before{content:"\\e936"}.fx-ic-yinlian2:before{content:"\\e611"}.fx-ic-youxiang:before{content:"\\e632"}.fx-ic-youxiang1:before{content:"\\e660"}.fx-ic-youxiang2:before{content:"\\e618"}.fx-ic-yulan:before{content:"\\e852"}.fx-ic-zaixianduibiweijihuo:before{content:"\\e7dc"}.fx-ic-zanting:before{content:"\\e662"}.fx-ic-zhanbi:before{content:"\\e6f5"}.fx-ic-zhankai:before{content:"\\e668"}.fx-ic-zhankai-01:before{content:"\\e710"}.fx-ic-zhaoshangyinhang:before{content:"\\e676"}.fx-ic-zhedie:before{content:"\\e639"}.fx-ic-zhengquetishitianchong:before{content:"\\e6a5"}.fx-ic-zhifubao:before{content:"\\e648"}.fx-ic-zhongyingwen:before{content:"\\e60c"}.fx-ic-zhongyingwenqiehuan-xianshiyingwen-login:before{content:"\\e66d"}.fx-ic-zhongyingwenqiehuan-xianshizhongwen:before{content:"\\e66b"}.fx-ic-zhongyingwenqiehuan-yingwen:before{content:"\\e616"}.fx-ic-zhujijuhe:before{content:"\\e838"}.fx-ic-zhuti:before{content:"\\e65f"}.fx-ic-zichan-fuwuqi:before{content:"\\e669"}.fx-ic-zitisetting-01:before{content:"\\e768"}.fx-ic-zong-01:before{content:"\\e75a"}`;
  let toolboxStyle = null;
  function injectStyle() {
    if (toolboxStyle && toolboxStyle.isConnected) return;
    if (!toolboxStyle) {
      toolboxStyle = document.createElement("style");
      toolboxStyle.id = "fofa-toolbox-style";
      toolboxStyle.textContent = `
/* FOFA 风格：以用户提供的首页截图为参考（背景 #040c1f / 卡片 #0d1527 / 青色重点）。 */
:root {
--fx-surface:#fff;--fx-layer:#f6f8fa;--fx-hover:#eef1f4;--fx-highlight:#e9fbfb;
--fx-text:#24292f;--fx-muted:#57606a;--fx-subtle:#8b949e;--fx-faint:#b8c0c8;
--fx-border:#d0d7de;--fx-line:#eef1f4;
--fx-accent:#05B5B6;--fx-accent-hover:#0ACBCB;--fx-accent-strong:#047F80;--fx-accent-ink:#032527;
--fx-success:#12804b;--fx-success-border:#b8dec6;--fx-danger:#c24136;
}
:root[data-fofa-toolbox-theme="dark"] {
--fx-surface:#0d1527;--fx-layer:#121e34;--fx-hover:#1c2c47;--fx-highlight:#133041;
--fx-text:#eaf5ff;--fx-muted:#b1c1d6;--fx-subtle:#8da2b9;--fx-faint:#7087a1;
--fx-border:#2b405b;--fx-line:#233550;
--fx-accent:#05dce2;--fx-accent-hover:#4bf4f2;--fx-accent-strong:#70eaf4;--fx-accent-ink:#031627;
--fx-success:#70e0b1;--fx-success-border:#316b65;--fx-danger:#ff8791;
}
#fofa-toolbox-menu{position:fixed;z-index:2147483647;width:368px;box-sizing:border-box;background:var(--fx-surface);color:var(--fx-text);
border:1px solid var(--fx-border);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.14);padding:8px;
font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
#fofa-toolbox-menu .fx-cond{width:100%;box-sizing:border-box;background:var(--fx-surface);border:1px solid var(--fx-border);border-radius:6px;
color:var(--fx-text);padding:5px 8px;font:12px/1.4 Consolas,Menlo,monospace;outline:none}
#fofa-toolbox-menu .fx-cond:focus{border-color:var(--fx-accent)}
#fofa-toolbox-menu .fx-btns{display:flex;gap:6px;margin-top:8px}
#fofa-toolbox-menu .fx-btns button{border:1px solid var(--fx-border);border-radius:6px;padding:5px 10px;cursor:pointer;
font:12px/1.4 inherit;background:var(--fx-layer);color:var(--fx-text);white-space:nowrap}
#fofa-toolbox-menu .fx-btns button:hover{background:var(--fx-hover)}
#fofa-toolbox-menu .fx-primary{flex:1;background:var(--fx-accent);border-color:var(--fx-accent);color:var(--fx-accent-ink);font-weight:600}
#fofa-toolbox-menu .fx-primary:hover{background:var(--fx-accent-hover);border-color:var(--fx-accent-hover)}
#fofa-toolbox-menu .fx-inc,#fofa-toolbox-menu .fx-or,#fofa-toolbox-menu .fx-eedit-ex,#fofa-toolbox-menu .fx-eedit-in{flex:1}
#fofa-toolbox-menu .fx-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;color:var(--fx-subtle);font-size:10px;margin-top:6px}
#fofa-toolbox-menu .fx-curwin{display:flex;align-items:center;gap:3px;cursor:pointer;user-select:none}
#fofa-toolbox-menu .fx-curwin input{margin:0;accent-color:var(--fx-accent)}
#fofa-toolbox-stage-bar{position:fixed;right:12px;bottom:12px;z-index:2147483646;background:var(--fx-accent);color:var(--fx-accent-ink);border-radius:16px;
padding:4px 12px;font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer;
box-shadow:0 4px 14px rgba(0,0,0,.28);user-select:none}
#fofa-toolbox-stage-bar:hover{background:var(--fx-accent-hover)}
#fofa-toolbox-stage-panel{position:fixed;right:12px;bottom:48px;z-index:2147483647;width:380px;box-sizing:border-box;
background:var(--fx-surface);color:var(--fx-text);border:1px solid var(--fx-border);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.14);padding:8px;
font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
#fofa-toolbox-stage-panel .fx-p-title{font-weight:600;color:var(--fx-muted);margin-bottom:6px}
#fofa-toolbox-stage-panel .fx-p-list{max-height:200px;overflow:auto}
#fofa-toolbox-stage-panel .fx-p-item{display:flex;align-items:center;gap:6px;padding:3px 4px;border-radius:4px}
#fofa-toolbox-stage-panel .fx-p-item:hover{background:var(--fx-layer)}
#fofa-toolbox-stage-panel .fx-p-item span{flex:1;font-family:Consolas,Menlo,monospace;font-size:11px;white-space:nowrap;
overflow:hidden;text-overflow:ellipsis}
#fofa-toolbox-stage-panel .fx-p-item b{cursor:pointer;color:var(--fx-subtle);font-weight:400;padding:0 4px}
#fofa-toolbox-stage-panel .fx-p-item b:hover{color:var(--fx-danger)}
#fofa-toolbox-stage-panel .fx-p-btns{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
#fofa-toolbox-stage-panel .fx-p-btns button{border:1px solid var(--fx-border);border-radius:6px;padding:5px 8px;cursor:pointer;
font:12px/1.4 inherit;background:var(--fx-layer);color:var(--fx-text);white-space:nowrap}
#fofa-toolbox-stage-panel .fx-p-btns button:hover{background:var(--fx-hover)}
#fofa-toolbox-stage-panel .fx-p-primary{flex:1;background:var(--fx-accent);border-color:var(--fx-accent);color:var(--fx-accent-ink);font-weight:600}
#fofa-toolbox-stage-panel .fx-p-primary:hover{background:var(--fx-accent-hover);border-color:var(--fx-accent-hover)}
#fofa-toolbox-rubber{position:fixed;z-index:2147483646;border:1.5px dashed var(--fx-accent);background:color-mix(in srgb, var(--fx-accent) 12%, transparent);
pointer-events:none}
#fofa-toolbox-btn{position:fixed;left:12px;bottom:12px;z-index:2147483646;background:var(--fx-surface);color:var(--fx-muted);
border:1px solid var(--fx-border);border-radius:16px;padding:4px 12px;cursor:pointer;user-select:none;
font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.2)}
#fofa-toolbox-btn:hover{color:var(--fx-accent);border-color:var(--fx-accent)}
#fofa-toolbox-box{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;width:1080px;
height:520px;max-width:94vw;max-height:84vh;display:flex;flex-direction:column;background:var(--fx-surface);color:var(--fx-text);border:1px solid var(--fx-border);
border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden;
font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
#fofa-toolbox-box.fx-l-lower{top:62%}
#fofa-toolbox-box .fx-l-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--fx-line);cursor:move;user-select:none}
#fofa-toolbox-box .fx-l-title{font-weight:600}
#fofa-toolbox-box .fx-l-hbtns{display:flex;gap:6px}
#fofa-toolbox-box .fx-l-hbtns button{border:1px solid var(--fx-border);background:var(--fx-layer);border-radius:6px;padding:4px 10px;
cursor:pointer;font:12px/1.4 inherit;color:var(--fx-text)}
#fofa-toolbox-box .fx-l-hbtns button:hover{background:var(--fx-hover)}
#fofa-toolbox-box .fx-l-tablewrap{overflow:auto;flex:1}
#fofa-toolbox-box .fx-l-table{border-collapse:collapse;width:100%}
#fofa-toolbox-box .fx-l-table th{position:sticky;top:0;background:var(--fx-layer);color:var(--fx-muted);font-weight:600;text-align:left;
padding:6px 8px;border-bottom:1px solid var(--fx-line);white-space:nowrap}
#fofa-toolbox-box .fx-l-table td{padding:5px 8px;border-bottom:1px solid var(--fx-line);vertical-align:top;word-break:break-all}
#fofa-toolbox-box .fx-l-table td[contenteditable]:focus{outline:1.5px solid var(--fx-accent);outline-offset:-1.5px;background:var(--fx-highlight)}
#fofa-toolbox-box .fx-l-mono{font-family:Consolas,Menlo,monospace;font-size:11px}
#fofa-toolbox-box .fx-l-ops b{cursor:pointer;color:var(--fx-subtle);font-weight:400;margin-right:6px}
#fofa-toolbox-box .fx-l-ops b.fx-l-search:hover{color:var(--fx-accent)}
#fofa-toolbox-box .fx-l-ops b.fx-l-dedup:hover{color:var(--fx-accent)}
#fofa-toolbox-box .fx-l-ops b.fx-l-undorow{color:var(--fx-accent)}
#fofa-toolbox-box .fx-l-ops b.fx-l-undorow:hover{color:var(--fx-accent-strong)}
#fofa-toolbox-box td.fx-rowdrag{cursor:grab;color:var(--fx-faint);text-align:center;user-select:none;font-size:13px}
#fofa-toolbox-box td.fx-rowdrag:active{cursor:grabbing;color:var(--fx-accent)}
#fofa-toolbox-box tr.fx-dragging td{opacity:.45}
#fofa-toolbox-box tr.fx-drop-above td{border-top:2px solid var(--fx-accent)}
#fofa-toolbox-box tr.fx-drop-below td{border-bottom:2px solid var(--fx-accent)}
#fofa-toolbox-box .fx-l-ops b.fx-l-cal:hover{color:var(--fx-accent)}
#fofa-toolbox-box .fx-l-ops b.fx-l-del:hover{color:var(--fx-danger)}
#fofa-toolbox-box .fx-l-ops b.fx-l-pinbtn:hover{color:var(--fx-accent-strong)}
#fofa-toolbox-box .fx-l-ops b.fx-l-pinbtn.on{color:var(--fx-accent-strong)}
#fofa-toolbox-box tr.fx-l-userpin td{background:var(--fx-highlight)}
#fofa-export-choice{position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);z-index:2147483647;width:340px;
background:var(--fx-surface);color:var(--fx-text);border:1px solid var(--fx-border);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.25);
padding:14px;font:12px/1.6 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
#fofa-export-choice .fx-e-title{font-weight:600;margin-bottom:6px}
#fofa-export-choice .fx-e-text{color:var(--fx-muted);margin-bottom:10px}
#fofa-export-choice .fx-e-btns{display:flex;gap:6px;flex-wrap:wrap}
#fofa-export-choice .fx-e-btns button{flex:1;border:1px solid var(--fx-border);background:var(--fx-layer);border-radius:6px;
padding:6px 8px;cursor:pointer;font:12px/1.4 inherit;color:var(--fx-text);white-space:nowrap}
#fofa-export-choice .fx-e-btns button:hover{background:var(--fx-hover)}
#fofa-export-choice .fx-e-resolve{background:var(--fx-accent);border-color:var(--fx-accent);color:var(--fx-accent-ink);font-weight:600}
#fofa-export-choice .fx-e-resolve:hover{background:var(--fx-accent-hover);border-color:var(--fx-accent-hover)}
#fofa-imp-toast{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:2147483647;max-width:480px;
background:var(--fx-surface);color:var(--fx-text);border:1px solid var(--fx-border);border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.22);
padding:10px 14px;font:12px/1.6 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer}
#fofa-imp-toast b{color:var(--fx-accent-strong)}
#fofa-toolbox-box .fx-l-empty{color:var(--fx-subtle);text-align:center;padding:24px}
#fofa-toolbox-box .fx-l-foot{padding:6px 12px;color:var(--fx-subtle);font-size:11px;border-top:1px solid var(--fx-line)}
#fofa-toolbox-box .fx-t-tabs{display:flex;gap:4px;margin-left:12px;flex:1}
#fofa-toolbox-box .fx-t-tab{border:1px solid var(--fx-border);background:var(--fx-layer);border-radius:6px;padding:3px 10px;
cursor:pointer;font:12px/1.4 inherit;color:var(--fx-muted);white-space:nowrap}
#fofa-toolbox-box .fx-t-tab:hover{background:var(--fx-hover)}
#fofa-toolbox-box .fx-t-tab.on{background:var(--fx-accent);border-color:var(--fx-accent);color:var(--fx-accent-ink);font-weight:600}
#fofa-toolbox-box .fx-t-body{flex:1;min-height:0;display:flex;flex-direction:column}
#fofa-toolbox-box .fx-t-pane{display:none;flex:1;min-height:0;flex-direction:column}
#fofa-toolbox-box .fx-t-pane.on{display:flex}
#fofa-toolbox-box .fx-l-tools{display:flex;gap:6px;padding:8px 12px 0;flex-wrap:wrap;align-items:center}
#fofa-toolbox-box .fx-l-count{color:var(--fx-subtle);font-size:11px;margin-right:2px}
#fofa-toolbox-box .fx-l-tools button{border:1px solid var(--fx-border);background:var(--fx-layer);border-radius:6px;padding:4px 10px;
cursor:pointer;font:12px/1.4 inherit;color:var(--fx-text);white-space:nowrap}
#fofa-toolbox-box .fx-l-tools button:hover{background:var(--fx-hover)}
#fofa-toolbox-box .fx-e-quick{display:flex;gap:6px;padding:8px 12px 0;flex-wrap:wrap}
#fofa-toolbox-box .fx-e-quick button,#fofa-toolbox-box .fx-e-adds button,#fofa-toolbox-box .fx-e-actions button{border:1px solid var(--fx-border);
background:var(--fx-layer);border-radius:6px;padding:4px 10px;cursor:pointer;font:12px/1.4 inherit;color:var(--fx-text);white-space:nowrap}
#fofa-toolbox-box .fx-e-quick button:hover,#fofa-toolbox-box .fx-e-adds button:hover,#fofa-toolbox-box .fx-e-actions button:hover{background:var(--fx-hover)}
#fofa-toolbox-box .fx-e-quick button.on{background:var(--fx-accent);border-color:var(--fx-accent);color:var(--fx-accent-ink);font-weight:600}
#fofa-toolbox-box .fx-e-cards{flex:1;min-height:0;overflow:auto;padding:8px 12px;display:flex;flex-direction:column;gap:6px}
#fofa-toolbox-box .fx-e-empty{color:var(--fx-subtle);text-align:center;padding:24px}
#fofa-toolbox-box .fx-e-group{border:1px solid var(--fx-line);border-radius:8px;padding:5px 8px}
#fofa-toolbox-box .fx-e-group.or{border-color:color-mix(in srgb, var(--fx-accent) 55%, transparent)}
#fofa-toolbox-box .fx-e-chead{display:flex;align-items:center;gap:4px;margin-bottom:2px}
#fofa-toolbox-box .fx-e-cfld{width:175px;border:1px solid var(--fx-border);border-radius:6px;padding:3px 6px;
font:12px/1.4 Consolas,Menlo,monospace;background:var(--fx-surface);color:var(--fx-text)}
#fofa-toolbox-box .fx-e-cjoin{border:1px solid var(--fx-border);border-radius:6px;padding:2px;font:12px/1.4 inherit;
background:var(--fx-surface);color:var(--fx-text)}
#fofa-toolbox-box .fx-e-cops{margin-left:auto;display:flex;gap:6px}
#fofa-toolbox-box .fx-e-cops b{cursor:pointer;color:var(--fx-subtle);font-weight:400}
#fofa-toolbox-box .fx-e-cops b.fx-e-cadd:hover{color:var(--fx-accent)}
#fofa-toolbox-box .fx-e-cops b.fx-e-cdel:hover{color:var(--fx-danger)}
#fofa-toolbox-box .fx-e-rowand{color:var(--fx-subtle);font-size:11px;padding:0 2px}
#fofa-toolbox-box .fx-e-row{display:flex;align-items:center;gap:4px;margin:2px 0}
#fofa-toolbox-box .fx-e-row input,#fofa-toolbox-box .fx-e-row select{border:1px solid var(--fx-border);border-radius:6px;
padding:3px 6px;font:12px/1.4 Consolas,Menlo,monospace;color:var(--fx-text);background:var(--fx-surface);box-sizing:content-box}
#fofa-toolbox-box .fx-e-row input.fld{width:118px}
#fofa-toolbox-box .fx-e-row input.val{flex:1;min-width:80px}
#fofa-toolbox-box .fx-e-row input.raw{flex:1;min-width:80px}
#fofa-toolbox-box .fx-e-row select{padding:3px 2px}
#fofa-toolbox-box .fx-e-row b{cursor:pointer;color:var(--fx-subtle);font-weight:400;padding:0 3px}
#fofa-toolbox-box .fx-e-row b:hover{color:var(--fx-danger)}
#fofa-toolbox-box .fx-e-or{color:var(--fx-accent-strong);font-size:11px;padding:0 2px}
#fofa-toolbox-box .fx-e-tag{color:var(--fx-subtle);font-size:10px;white-space:nowrap}
#fofa-toolbox-box .fx-e-adds{display:flex;gap:6px;padding:6px 12px 0}
#fofa-toolbox-box .fx-e-qtext{margin:8px 12px 0;width:calc(100% - 24px);box-sizing:border-box;display:block;
min-height:52px;max-height:160px;resize:vertical;background:var(--fx-layer);border:1px solid var(--fx-border);border-radius:6px;
color:var(--fx-muted);padding:6px 8px;font:11px/1.5 Consolas,Menlo,monospace;word-break:break-all;outline:none}
#fofa-toolbox-box .fx-e-qtext:focus{border-color:var(--fx-accent);background:var(--fx-highlight);color:var(--fx-text)}
#fofa-toolbox-box .fx-e-qtext::placeholder{color:var(--fx-faint)}
#fofa-toolbox-box .fx-e-actions{display:flex;gap:6px;padding:8px 12px}
#fofa-toolbox-box .fx-e-actions .fx-e-search{flex:1;background:var(--fx-accent);border-color:var(--fx-accent);color:var(--fx-accent-ink);font-weight:600}
#fofa-toolbox-box .fx-e-actions .fx-e-search:hover{background:var(--fx-accent-hover);border-color:var(--fx-accent-hover)}
#fofa-toolbox-box .fx-e-hint{padding:6px 12px;color:var(--fx-subtle);font-size:11px;border-top:1px solid var(--fx-line)}
#fofa-toolbox-box .fx-e-pbox{margin:6px 12px 0;border:1px solid var(--fx-line);border-radius:8px;padding:6px 8px}
#fofa-toolbox-box .fx-e-prow{display:flex;gap:6px;margin-bottom:4px}
#fofa-toolbox-box .fx-e-pname{flex:1;border:1px solid var(--fx-border);border-radius:6px;padding:3px 8px;
font:12px/1.4 inherit;background:var(--fx-surface);color:var(--fx-text);outline:none}
#fofa-toolbox-box .fx-e-pname:focus{border-color:var(--fx-accent)}
#fofa-toolbox-box .fx-e-psave{border:1px solid var(--fx-border);background:var(--fx-layer);border-radius:6px;padding:3px 10px;
cursor:pointer;font:12px/1.4 inherit;color:var(--fx-text);white-space:nowrap}
#fofa-toolbox-box .fx-e-psave:hover{background:var(--fx-hover)}
#fofa-toolbox-box .fx-e-plist{max-height:150px;overflow:auto}
#fofa-toolbox-box .fx-e-pitem{display:flex;align-items:center;gap:6px;padding:2px 0}
#fofa-toolbox-box .fx-e-pitem .fx-e-pn{color:var(--fx-text);font-weight:600;max-width:130px;white-space:nowrap;
overflow:hidden;text-overflow:ellipsis}
#fofa-toolbox-box .fx-e-pitem .fx-e-pc{flex:1;color:var(--fx-muted);font-family:Consolas,Menlo,monospace;font-size:11px;
white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
#fofa-toolbox-box .fx-e-pitem .fx-e-pc:hover{color:var(--fx-accent)}
#fofa-toolbox-box .fx-e-pitem b{cursor:pointer;color:var(--fx-subtle);font-weight:400;padding:0 4px}
#fofa-toolbox-box .fx-e-pitem b.fx-e-pins{color:var(--fx-accent)}
#fofa-toolbox-box .fx-e-pitem b.fx-e-pdel:hover{color:var(--fx-danger)}
#fofa-toolbox-box .fx-e-pempty{color:var(--fx-subtle);font-size:11px;padding:4px 0}
#fofa-toolbox-box .fx-t-resize{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;z-index:5;
background:linear-gradient(135deg,transparent 0 46%,var(--fx-faint) 46% 54%,transparent 54% 66%,var(--fx-faint) 66% 74%,transparent 74% 86%,var(--fx-faint) 86% 94%,transparent 94%)}
#fofa-toolbox-box .fx-t-resize:hover{background:linear-gradient(135deg,transparent 0 46%,var(--fx-accent) 46% 54%,transparent 54% 66%,var(--fx-accent) 66% 74%,transparent 74% 86%,var(--fx-accent) 86% 94%,transparent 94%)}
#fofa-toolbox-box .fx-k-search,#fofa-toolbox-box .fx-l-libsearch{flex:1;min-width:170px;border:1px solid var(--fx-border);
border-radius:6px;padding:4px 8px;font:12px/1.4 inherit;background:var(--fx-surface);color:var(--fx-text);outline:none}
#fofa-toolbox-box .fx-k-search:focus,#fofa-toolbox-box .fx-l-libsearch:focus{border-color:var(--fx-accent)}
#fofa-toolbox-box td.fx-k-imgs{white-space:normal;min-width:150px}
#fofa-toolbox-box td.fx-k-imgs:focus{outline:1.5px solid var(--fx-accent);outline-offset:-1.5px}
#fofa-toolbox-box .fx-k-thumbwrap{position:relative;display:inline-block;margin:1px}
#fofa-toolbox-box .fx-k-thumb{width:46px;height:31px;object-fit:cover;border:1px solid var(--fx-line);border-radius:3px;
cursor:zoom-in;display:block;background:var(--fx-surface)}
#fofa-toolbox-box .fx-k-thumbwrap b{position:absolute;right:-4px;top:-5px;cursor:pointer;color:var(--fx-accent-ink);background:#e5484d;
border-radius:50%;width:13px;height:13px;line-height:12px;text-align:center;font-size:9px;font-weight:400;display:none}
#fofa-toolbox-box .fx-k-thumbwrap:hover b{display:block}
#fofa-toolbox-box .fx-k-imgs .fx-k-addimg{color:var(--fx-subtle);cursor:pointer;font-weight:400;font-size:11px;padding:0 3px}
#fofa-toolbox-box .fx-k-imgs .fx-k-addimg:hover{color:var(--fx-accent)}
#fofa-toolbox-box .fx-k-hint{color:var(--fx-faint);font-size:10px}
#fofa-kb-lightbox{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.82);display:flex;
align-items:center;justify-content:center;cursor:zoom-out}
#fofa-kb-lightbox img{max-width:92vw;max-height:92vh;border-radius:4px;box-shadow:0 6px 40px rgba(0,0,0,.5)}
#fofa-ac-ghost{position:absolute;z-index:2147483645;pointer-events:none;color:transparent;white-space:pre;
overflow:hidden;display:none}
#fofa-ac-ghost.ta{white-space:pre-wrap;word-break:break-all;box-sizing:border-box}
#fofa-ac-ghost .sug{color:var(--fx-faint)}
#fofa-ac-dd{position:absolute;z-index:2147483646;background:var(--fx-surface);border:1px solid var(--fx-border);border-radius:8px;
box-shadow:0 4px 16px rgba(0,0,0,.14);padding:4px;min-width:120px;overflow:auto;display:none;
font:12px/1.6 Consolas,Menlo,monospace;color:var(--fx-text)}
#fofa-ac-dd .ac-hint{color:var(--fx-subtle);font-size:10px;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;
text-align:center;padding:1px 0 3px;border-bottom:1px solid var(--fx-line);margin-bottom:2px}
#fofa-ac-dd .ac-it{padding:2px 10px;border-radius:4px;cursor:pointer;white-space:nowrap}
#fofa-ac-dd .ac-it:hover{background:var(--fx-layer)}
#fofa-ac-dd .ac-it.on{background:var(--fx-accent);color:var(--fx-accent-ink)}
#fofa-toolbox-box .fx-l-ghead td,#fofa-preset-mgr .fx-l-ghead td{background:var(--fx-layer);color:var(--fx-muted);font-weight:600;
padding:4px 8px;border-bottom:1px solid var(--fx-line)}
#fofa-toolbox-box tr.fx-l-ghead{cursor:pointer}
#fofa-toolbox-box tr.fx-l-ghead:hover td{color:var(--fx-accent)}
#fofa-toolbox-box .fx-l-ghead td span,#fofa-preset-mgr .fx-l-ghead td span{color:var(--fx-subtle);font-weight:400;margin-left:6px}
#fofa-toolbox-box .fx-e-group.fx-e-hl{border-color:var(--fx-accent);box-shadow:0 0 0 1.5px color-mix(in srgb, var(--fx-accent) 40%, transparent)}
#fofa-toolbox-box .fx-l-folders,#fofa-toolbox-box .fx-k-folders{display:flex;gap:6px;padding:8px 12px 0;flex-wrap:wrap}
#fofa-toolbox-box .fx-l-fchip{border:1px solid var(--fx-border);background:var(--fx-layer);border-radius:14px;padding:2px 10px;
cursor:pointer;font:12px/1.4 inherit;color:var(--fx-muted);white-space:nowrap}
#fofa-toolbox-box .fx-l-fchip:hover{background:var(--fx-hover)}
#fofa-toolbox-box .fx-l-fchip.on{background:var(--fx-accent);border-color:var(--fx-accent);color:var(--fx-accent-ink);font-weight:600}
#fofa-toolbox-box .fx-l-ops b.fx-l-filebtn:hover{color:var(--fx-accent-strong)}
#fofa-toolbox-box .fx-l-selbar{display:flex;gap:6px;padding:8px 12px 0;align-items:center;flex-wrap:wrap}
#fofa-toolbox-box .fx-l-selbar .fx-l-selcnt{color:var(--fx-muted)}
#fofa-toolbox-box .fx-l-selbar .fx-l-selcnt b{color:var(--fx-accent-strong)}
#fofa-toolbox-box .fx-l-selbar button{border:1px solid var(--fx-border);background:var(--fx-layer);border-radius:6px;padding:4px 10px;
cursor:pointer;font:12px/1.4 inherit;color:var(--fx-text);white-space:nowrap}
#fofa-toolbox-box .fx-l-selbar button:hover{background:var(--fx-hover)}
#fofa-toolbox-box .fx-l-selbar .fx-l-selmove{background:var(--fx-accent);border-color:var(--fx-accent);color:var(--fx-accent-ink);font-weight:600}
#fofa-toolbox-box .fx-l-selbar .fx-l-selmove:hover{background:var(--fx-accent-hover);border-color:var(--fx-accent-hover)}
#fofa-toolbox-box td.fx-l-sel{text-align:center;width:26px}
#fofa-toolbox-box td.fx-l-sel input{margin:0;accent-color:var(--fx-accent);cursor:pointer}
#fofa-toolbox-box .fx-l-quickbox{display:flex;gap:6px;padding:6px 12px 0;flex-wrap:wrap}
#fofa-toolbox-box .fx-l-quickbox button{border:1px solid var(--fx-border);background:var(--fx-layer);border-radius:6px;padding:4px 10px;
cursor:pointer;font:12px/1.4 inherit;color:var(--fx-text);white-space:nowrap}
#fofa-toolbox-box .fx-l-quickbox button:hover{background:var(--fx-hover)}
#fofa-toolbox-box .fx-l-ops b.fx-l-toedit:hover{color:var(--fx-accent)}
#fofa-toolbox-box .fx-e-pmgr{margin-top:4px;border-top:1px dashed var(--fx-line);padding-top:4px}
#fofa-toolbox-box .fx-e-pmgr b{color:var(--fx-muted);cursor:pointer;font-weight:600}
#fofa-toolbox-box .fx-e-pmgr b:hover{color:var(--fx-accent)}
#fofa-preset-mgr{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;width:860px;
max-width:94vw;height:560px;max-height:84vh;display:flex;flex-direction:column;background:var(--fx-surface);color:var(--fx-text);
border:1px solid var(--fx-border);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden;
font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
#fofa-preset-mgr .fx-m-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--fx-line)}
#fofa-preset-mgr .fx-m-title{font-weight:600;white-space:nowrap}
#fofa-preset-mgr .fx-m-search{flex:1;min-width:170px;border:1px solid var(--fx-border);border-radius:6px;padding:4px 8px;
font:12px/1.4 inherit;background:var(--fx-surface);color:var(--fx-text);outline:none}
#fofa-preset-mgr .fx-m-search:focus{border-color:var(--fx-accent)}
#fofa-preset-mgr .fx-l-hbtns button{border:1px solid var(--fx-border);background:var(--fx-layer);border-radius:6px;padding:4px 10px;
cursor:pointer;font:12px/1.4 inherit;color:var(--fx-text)}
#fofa-preset-mgr .fx-l-hbtns button:hover{background:var(--fx-hover)}
#fofa-preset-mgr .fx-m-tools{display:flex;gap:6px;padding:8px 12px 0;align-items:center;flex-wrap:wrap}
#fofa-preset-mgr .fx-l-count{color:var(--fx-subtle);font-size:11px}
#fofa-preset-mgr .fx-m-tools button{border:1px solid var(--fx-border);background:var(--fx-layer);border-radius:6px;padding:4px 10px;
cursor:pointer;font:12px/1.4 inherit;color:var(--fx-text);white-space:nowrap}
#fofa-preset-mgr .fx-m-tools button:hover{background:var(--fx-hover)}
#fofa-preset-mgr .fx-m-tablewrap{flex:1;min-height:0;overflow:auto;margin-top:6px}
#fofa-preset-mgr .fx-l-table{border-collapse:collapse;width:100%}
#fofa-preset-mgr .fx-l-table th{position:sticky;top:0;background:var(--fx-layer);color:var(--fx-muted);font-weight:600;text-align:left;
padding:6px 8px;border-bottom:1px solid var(--fx-line);white-space:nowrap}
#fofa-preset-mgr .fx-l-table td{padding:5px 8px;border-bottom:1px solid var(--fx-line);vertical-align:top;word-break:break-all}
#fofa-preset-mgr .fx-l-table td[contenteditable]:focus{outline:1.5px solid var(--fx-accent);outline-offset:-1.5px;background:var(--fx-highlight)}
#fofa-preset-mgr .fx-l-mono{font-family:Consolas,Menlo,monospace;font-size:11px}
#fofa-preset-mgr .fx-l-ops b{cursor:pointer;color:var(--fx-subtle);font-weight:400;margin-right:6px}
#fofa-preset-mgr .fx-l-ops b:hover{color:var(--fx-accent)}
#fofa-preset-mgr .fx-l-ops b.fx-m-pdel:hover{color:var(--fx-danger)}
#fofa-preset-mgr .fx-l-ops b.fx-m-pins,#fofa-preset-mgr .fx-l-ops b.fx-m-povr{color:var(--fx-accent-strong)}
#fofa-preset-mgr td.fx-rowdrag{cursor:grab;color:var(--fx-faint);text-align:center;user-select:none;font-size:13px}
#fofa-preset-mgr td.fx-rowdrag:active{cursor:grabbing;color:var(--fx-accent)}
#fofa-preset-mgr tr.fx-dragging td{opacity:.45}
#fofa-preset-mgr tr.fx-drop-above td{border-top:2px solid var(--fx-accent)}
#fofa-preset-mgr tr.fx-drop-below td{border-bottom:2px solid var(--fx-accent)}
#fofa-preset-mgr .fx-l-empty{color:var(--fx-subtle);text-align:center;padding:24px}
#fofa-preset-mgr .fx-l-foot{padding:6px 12px;color:var(--fx-subtle);font-size:11px;border-top:1px solid var(--fx-line)}
#fofa-preset-mgr tr.fx-m-peditor td{background:var(--fx-highlight);padding:0 6px 6px}
#fofa-preset-mgr .fx-e-cards{max-height:190px;overflow:auto}
#fofa-preset-mgr .fx-e-qtext{min-height:40px;max-height:110px}
#fofa-preset-mgr .fx-e-pactions{display:flex;gap:6px;padding:6px 12px 8px}
#fofa-preset-mgr .fx-e-pactions button{border:1px solid var(--fx-border);background:var(--fx-layer);border-radius:6px;padding:4px 10px;
cursor:pointer;font:12px/1.4 inherit;color:var(--fx-text);white-space:nowrap}
#fofa-preset-mgr .fx-e-pactions .fx-e-psave2{background:var(--fx-accent);border-color:var(--fx-accent);color:var(--fx-accent-ink);font-weight:600}
#fofa-preset-mgr .fx-e-pactions .fx-e-psave2:hover{background:var(--fx-accent-hover);border-color:var(--fx-accent-hover)}
/* 完整组件配色：工具箱、预设管理、右键菜单、暂存面板、确认框、状态条与补全下拉，随 FOFA 深浅主题适配。 */
:root[data-fofa-toolbox-theme="dark"] :is(#fofa-toolbox-box,#fofa-toolbox-menu,#fofa-toolbox-stage-panel,#fofa-export-choice,#fofa-imp-toast,#fofa-toolbox-btn,#fofa-preset-mgr,#fofa-ac-dd) { color-scheme:dark; }
:root[data-fofa-toolbox-theme="light"] :is(#fofa-toolbox-box,#fofa-toolbox-menu,#fofa-toolbox-stage-panel,#fofa-export-choice,#fofa-imp-toast,#fofa-toolbox-btn,#fofa-preset-mgr,#fofa-ac-dd) { color-scheme:light; }
:root[data-fofa-toolbox-theme="dark"] #fofa-toolbox-box,
:root[data-fofa-toolbox-theme="dark"] #fofa-preset-mgr {
box-shadow:0 18px 62px rgba(0,0,0,.52),0 0 0 1px rgba(5,220,226,.06);
}
:root[data-fofa-toolbox-theme="dark"] #fofa-toolbox-box .fx-l-head,
:root[data-fofa-toolbox-theme="dark"] #fofa-preset-mgr .fx-m-head {
background:linear-gradient(100deg,#101e35 0%,#0d1527 78%);
border-bottom-color:var(--fx-border);
}
#fofa-toolbox-box .fx-l-hbtns {align-items:center}
#fofa-toolbox-box .fx-theme-toggle {border-radius:15px;padding:4px 10px;min-width:69px;white-space:nowrap}
:root[data-fofa-toolbox-theme="dark"] #fofa-toolbox-box .fx-theme-toggle {
background:#142b40;color:var(--fx-accent);border-color:#20566c;
}
:root[data-fofa-toolbox-theme="dark"] #fofa-toolbox-box .fx-theme-toggle:hover {background:#1b3b50;border-color:var(--fx-accent)}
:root[data-fofa-toolbox-theme="dark"] #fofa-toolbox-box :is(.fx-l-table tr:hover td:not([contenteditable]:focus),.fx-p-item:hover),
:root[data-fofa-toolbox-theme="dark"] #fofa-preset-mgr .fx-l-table tr:hover td:not([contenteditable]:focus) {background:var(--fx-hover)}
#fofa-toolbox-box :is(input,select,textarea),#fofa-preset-mgr :is(input,select,textarea) {accent-color:var(--fx-accent)}
#fofa-toolbox-box :is(input,textarea)::placeholder,#fofa-toolbox-menu input::placeholder,
#fofa-preset-mgr :is(input,textarea)::placeholder {color:var(--fx-subtle);opacity:1}
:is(#fofa-toolbox-box,#fofa-toolbox-menu,#fofa-toolbox-stage-panel,#fofa-preset-mgr) :is(input,select,textarea):focus-visible {outline:1px solid var(--fx-accent);outline-offset:0;border-color:var(--fx-accent)}
:is(#fofa-toolbox-box,#fofa-toolbox-menu,#fofa-toolbox-stage-panel,#fofa-export-choice,#fofa-preset-mgr) button:focus-visible {outline:2px solid var(--fx-accent);outline-offset:2px}
:is(#fofa-toolbox-box,#fofa-preset-mgr) :is(.fx-l-tablewrap,.fx-e-cards,.fx-e-plist,.fx-l-table,.fx-m-tablewrap) {scrollbar-color:var(--fx-border) var(--fx-surface)}
:root[data-fofa-toolbox-theme="dark"] #fofa-toolbox-box :is(.fx-l-userpin td, td[contenteditable]:focus),
:root[data-fofa-toolbox-theme="dark"] #fofa-preset-mgr :is(tr.fx-m-peditor td, td[contenteditable]:focus) {color:var(--fx-text)}
#fofa-toolbox-box .fx-k-thumb {background:#fff} /* 截图本体保持白底，避免透明产品截图失真 */
${ICON_CSS}`;
      (document.head || document.documentElement).appendChild(toolboxStyle);
    }
  }
  function initStyleGuard() {
    new MutationObserver(() => injectStyle()).observe(document.head || document.documentElement, { childList: true });
  }
  const FOFA_THEME_SVG = '<svg viewBox="0 0 18 15" width="13" height="11" style="vertical-align:-.12em" aria-hidden="true"><path fill="currentColor" d="M9.057 14.976c-3.094 0-4.995-.44-5.81-1.344-.431-.477-.41-.927-.393-1.053.01-.112.298-3.556.542-5.162-.089-.058-.276-.13-.383-.175a3 3 0 0 1-.266-.11c-.36-.164-1.105-.525-1.105-.525C.716 6.191.168 5.662.03 5.044c-.108-.494.077-.92.285-1.157a1 1 0 0 1 .08-.077L4.75.182a.775.775 0 0 1 1.225.33c.477 1.381 1.86 1.587 2.644 1.587.208 0 .34-.016.342-.016a1 1 0 0 1 .202 0s.13.016.33.016c.768 0 2.124-.206 2.594-1.585a.76.76 0 0 1 .525-.484.78.78 0 0 1 .704.157l4.29 3.628a1 1 0 0 1 .08.077c.206.234.388.66.28 1.154-.134.616-.676 1.142-1.608 1.566 0 0-.72.354-1.069.517q-.12.054-.264.11c-.105.043-.29.115-.376.174.242 1.62.525 5.054.537 5.201.012.094.033.545-.4 1.025-.81.902-2.685 1.337-5.729 1.337M4.388 12.63c.13.15.94.85 4.67.85 3.686 0 4.472-.704 4.592-.847-.058-.672-.314-3.657-.523-5.03-.175-1.155.91-1.585 1.32-1.747q.099-.038.183-.075c.343-.159 1.057-.51 1.057-.51.47-.213.661-.386.736-.473l-3.36-2.846c-1.012 1.465-2.769 1.643-3.57 1.643-.189 0-.342-.01-.436-.019a6 6 0 0 1-.44.019c-.813 0-2.594-.18-3.617-1.653L1.58 4.796c.078.089.27.257.726.46.021.01.745.361 1.092.523q.084.037.185.075c.415.161 1.512.592 1.335 1.748-.213 1.39-.48 4.424-.53 5.028"/></svg>';
  const THEME_KEY = "fofa-toolbox-theme";
  let toolboxMode = "auto";
  let toolboxTheme = "dark";
  try {
    const saved = localStorage.getItem(THEME_KEY);
    toolboxMode = saved === "dark" || saved === "light" ? saved : "auto";
  } catch (e) {
  }
  function fofaTheme() {
    const cl = document.documentElement.classList;
    if (cl.contains("light")) return "light";
    if (cl.contains("dark")) return "dark";
    const m = /(?:^|;\s*)fofa_theme=(dark|light)/.exec(document.cookie || "");
    return m ? m[1] : "dark";
  }
  function effectiveTheme() {
    return toolboxMode === "auto" ? fofaTheme() : toolboxMode;
  }
  function syncThemeButton() {
    const btn = document.querySelector("#fofa-toolbox-box .fx-theme-toggle");
    if (!btn) return;
    const dark = toolboxTheme === "dark";
    const label = toolboxMode === "auto" ? `跟随·${dark ? "深" : "浅"}` : dark ? "深色" : "浅色";
    btn.innerHTML = FOFA_THEME_SVG + " " + label;
    btn.title = toolboxMode === "auto" ? `外观：跟随 FOFA 页面皮肤（当前${dark ? "深色" : "浅色"}），点击改为深色` : `外观：${dark ? "FOFA 风格深色" : "浅色"}，点击${dark ? "改为浅色" : "恢复跟随 FOFA"}`;
    btn.setAttribute("aria-label", btn.title);
    btn.setAttribute("aria-pressed", String(dark));
  }
  function applyToolboxTheme() {
    toolboxTheme = effectiveTheme();
    const root = document.documentElement;
    if (root && typeof root.setAttribute === "function") root.setAttribute("data-fofa-toolbox-theme", toolboxTheme);
    syncThemeButton();
  }
  function setToolboxTheme(mode) {
    toolboxMode = mode === "dark" || mode === "light" ? mode : "auto";
    try {
      localStorage.setItem(THEME_KEY, toolboxMode);
    } catch (e) {
    }
    applyToolboxTheme();
  }
  function cycleToolboxTheme() {
    setToolboxTheme(toolboxMode === "auto" ? "dark" : toolboxMode === "dark" ? "light" : "auto");
  }
  function initTheme() {
    applyToolboxTheme();
    new MutationObserver(() => {
      if (toolboxMode === "auto") applyToolboxTheme();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("storage", (e) => {
      if (e.key !== THEME_KEY) return;
      toolboxMode = e.newValue === "dark" || e.newValue === "light" ? e.newValue : "auto";
      applyToolboxTheme();
    });
  }
  let boxUserClosed = false;
  const LIB_POS_KEY = "fofa-lib-pos";
  let libDrag = null;
  const BOX_SIZE_KEY = "fofa-box-size";
  let boxResize = null;
  function closeToolbox(byUser) {
    if (byUser) boxUserClosed = true;
    const p = document.getElementById("fofa-toolbox-box");
    if (p) p.remove();
  }
  function applySavedLibPos(panel) {
    try {
      const pos = JSON.parse(localStorage.getItem(LIB_POS_KEY) || "null");
      if (pos && typeof pos.l === "number" && typeof pos.t === "number") {
        panel.style.left = Math.max(0, Math.min(pos.l, innerWidth - 100)) + "px";
        panel.style.top = Math.max(0, Math.min(pos.t, innerHeight - 40)) + "px";
        panel.style.transform = "none";
        return true;
      }
    } catch (e) {
    }
    return false;
  }
  function resetLibPos(panel) {
    try {
      localStorage.removeItem(LIB_POS_KEY);
      localStorage.removeItem(BOX_SIZE_KEY);
    } catch (e) {
    }
    panel.style.left = "";
    panel.style.top = "";
    panel.style.transform = "";
    panel.style.width = "";
    panel.style.height = "";
    panel.style.maxWidth = "";
    panel.style.maxHeight = "";
  }
  function attachToolboxDrag(panel) {
    panel.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      const head = e.target.closest && e.target.closest(".fx-l-head");
      if (!head || e.target.closest && e.target.closest("button")) return;
      const r = panel.getBoundingClientRect();
      panel.style.left = r.left + "px";
      panel.style.top = r.top + "px";
      panel.style.transform = "none";
      libDrag = { panel, dx: e.clientX - r.left, dy: e.clientY - r.top };
      e.preventDefault();
    });
    panel.addEventListener("dblclick", (e) => {
      const head = e.target.closest && e.target.closest(".fx-l-head");
      if (head && !(e.target.closest && e.target.closest("button"))) resetLibPos(panel);
    });
  }
  function applySavedBoxSize(panel) {
    try {
      const sz = JSON.parse(localStorage.getItem(BOX_SIZE_KEY) || "null");
      if (sz && sz.w >= 420 && sz.h >= 260) {
        panel.style.width = Math.min(sz.w, innerWidth - 16) + "px";
        panel.style.height = Math.min(sz.h, innerHeight - 16) + "px";
        panel.style.maxWidth = "none";
        panel.style.maxHeight = "none";
      }
    } catch (e) {
    }
  }
  function attachBoxResize(panel) {
    const grip = panel.querySelector(".fx-t-resize");
    if (!grip) return;
    grip.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const r = panel.getBoundingClientRect();
      panel.style.left = r.left + "px";
      panel.style.top = r.top + "px";
      panel.style.transform = "none";
      boxResize = { panel, x: e.clientX, y: e.clientY, w: r.width, h: r.height };
    });
  }
  let toolboxTab = "lib";
  function openToolbox(lower, tab) {
    closeToolbox(false);
    injectStyle();
    const panel = document.createElement("div");
    panel.id = "fofa-toolbox-box";
    if (lower) panel.classList.add("fx-l-lower");
    panel.innerHTML = `
    <div class="fx-l-head">
      <span class="fx-l-title">${ic("toolbox")} FOFA 工具箱</span>
      <span class="fx-t-tabs">
        <button class="fx-t-tab fx-t-tab-lib" data-tab="lib" title="指纹收藏库">${ic("lib")} 指纹库</button>
        <button class="fx-t-tab fx-t-tab-edit" data-tab="edit" title="结构化编辑当前搜索语句并发起查询">${ic("edit")} 查询编辑器</button>
        <button class="fx-t-tab fx-t-tab-kb" data-tab="kb" title="厂商贴牌关系与产品特征（Server/Title/截图）">${ic("kb")} 知识库</button>
      </span>
      <span class="fx-l-hbtns"><button type="button" class="fx-theme-toggle" title="切换工具箱外观">${ic("theme")} 浅色</button><button class="fx-l-close" title="收起工具箱（Esc）">关闭</button></span>
    </div>
    <div class="fx-t-body">
      <div class="fx-t-pane fx-t-pane-lib"></div>
      <div class="fx-t-pane fx-t-pane-edit"></div>
      <div class="fx-t-pane fx-t-pane-kb"></div>
    </div>
    <div class="fx-t-resize" title="拖动调整宽高（双击标题栏恢复默认尺寸与居中）"></div>`;
    renderLib(panel.querySelector(".fx-t-pane-lib"));
    attachLibEvents(panel.querySelector(".fx-t-pane-lib"));
    buildEditor(panel.querySelector(".fx-t-pane-edit"));
    buildKb(panel.querySelector(".fx-t-pane-kb"));
    panel.querySelector(".fx-theme-toggle").addEventListener("click", () => cycleToolboxTheme());
    syncThemeButton();
    panel.querySelector(".fx-l-close").addEventListener("click", () => closeToolbox(true));
    panel.querySelectorAll(".fx-t-tab").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
    attachToolboxDrag(panel);
    applySavedLibPos(panel);
    applySavedBoxSize(panel);
    attachBoxResize(panel);
    document.documentElement.appendChild(panel);
    syncThemeButton();
    switchTab(tab || toolboxTab);
  }
  const TOOLBOX_TABS = ["lib", "edit", "kb"];
  function switchTab(tab) {
    toolboxTab = tab;
    const box = document.getElementById("fofa-toolbox-box");
    if (!box) return;
    for (const t of TOOLBOX_TABS) {
      box.querySelector(".fx-t-tab-" + t).classList.toggle("on", tab === t);
      box.querySelector(".fx-t-pane-" + t).classList.toggle("on", tab === t);
    }
    if (tab === "edit" && editMain && editMain.pageChanged()) editMain.parseFromPage();
  }
  function ensureToolboxBtn() {
    if (document.getElementById("fofa-toolbox-btn")) return;
    const b = document.createElement("div");
    b.id = "fofa-toolbox-btn";
    b.innerHTML = ic("toolbox") + " 工具箱";
    b.title = "打开工具箱（Alt+Q）：指纹库 / 查询编辑器";
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (document.getElementById("fofa-toolbox-box")) closeToolbox(true);
      else openToolbox();
    });
    document.documentElement.appendChild(b);
  }
  function initToolboxDrag() {
    document.addEventListener("mousemove", (e) => {
      if (boxResize) {
        const p2 = boxResize.panel;
        const w = Math.max(420, Math.min(boxResize.w + e.clientX - boxResize.x, innerWidth - 8));
        const h = Math.max(260, Math.min(boxResize.h + e.clientY - boxResize.y, innerHeight - 8));
        p2.style.width = w + "px";
        p2.style.height = h + "px";
        p2.style.maxWidth = "none";
        p2.style.maxHeight = "none";
        return;
      }
      if (!libDrag) return;
      const p = libDrag.panel;
      const l = Math.max(60 - p.offsetWidth, Math.min(e.clientX - libDrag.dx, innerWidth - 60));
      const t = Math.max(0, Math.min(e.clientY - libDrag.dy, innerHeight - 36));
      p.style.left = l + "px";
      p.style.top = t + "px";
    }, true);
    document.addEventListener("mouseup", () => {
      if (boxResize) {
        const p2 = boxResize.panel;
        boxResize = null;
        try {
          localStorage.setItem(BOX_SIZE_KEY, JSON.stringify({ w: p2.offsetWidth, h: p2.offsetHeight }));
        } catch (e) {
        }
      }
      if (!libDrag) return;
      const p = libDrag.panel;
      libDrag = null;
      try {
        localStorage.setItem(LIB_POS_KEY, JSON.stringify({ l: parseInt(p.style.left, 10) || 0, t: parseInt(p.style.top, 10) || 0 }));
      } catch (e) {
      }
    }, true);
  }
  function initToolboxBtn() {
    setInterval(() => {
      injectStyle();
      ensureToolboxBtn();
    }, 2e3);
    ensureToolboxBtn();
    setInterval(() => {
      if (boxUserClosed) return;
      const home = location.pathname === "/" || location.pathname === "";
      if (home && !document.getElementById("fofa-toolbox-box")) openToolbox(true);
    }, 1500);
  }
  const STAGE_KEY = "fofa-toolbox-staged";
  const CURWIN_KEY = "fofa-toolbox-current";
  function loadStaged() {
    try {
      const a = JSON.parse(sessionStorage.getItem(STAGE_KEY) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }
  function saveStaged(arr) {
    try {
      sessionStorage.setItem(STAGE_KEY, JSON.stringify(arr));
    } catch (e) {
    }
  }
  function openInCurrent() {
    try {
      return sessionStorage.getItem(CURWIN_KEY) === "1";
    } catch (e) {
      return false;
    }
  }
  function joinIncludeBatch(cur, conds) {
    const q = String(cur || "");
    const groups = /* @__PURE__ */ new Map();
    const seq = [];
    for (const c of conds) {
      const clean = String(c).replace(/\s+/g, " ").trim();
      if (!clean || q.includes(clean)) continue;
      const m = /^([A-Za-z_][\w.]*)\s*={1,2}(?!=)\s*([\s\S]+)$/.exec(clean);
      if (!m) {
        seq.push({ s: clean });
        continue;
      }
      const gk = m[1].toLowerCase();
      if (!groups.has(gk)) {
        groups.set(gk, []);
        seq.push({ g: gk });
      }
      const vk = m[2].replace(/\s+/g, " ").trim();
      if (groups.get(gk).some((x) => x.vk === vk)) continue;
      groups.get(gk).push({ vk, clean });
    }
    const pieces = [];
    for (const it of seq) {
      if (it.s) {
        pieces.push(it.s);
        continue;
      }
      const g = groups.get(it.g);
      pieces.push(g.length > 1 ? "(" + g.map((x) => x.clean).join(" || ") + ")" : g[0].clean);
    }
    return pieces.join(" && ");
  }
  function applyBatch(cur, conds, mode) {
    const q0 = (cur || "").trim();
    if (mode !== "include") {
      let q = q0;
      for (const c of conds) {
        const clean = String(c).replace(/\s+/g, " ").trim();
        if (!clean) continue;
        if (q.includes(clean)) {
          q = q.replace(clean, negate(clean) || clean);
          continue;
        }
        const piece = negate(clean) || clean;
        q = q ? q + " && " + piece : piece;
      }
      return q;
    }
    const joined = joinIncludeBatch(q0, conds);
    return joined ? q0 ? q0 + " && " + joined : joined : q0;
  }
  function editorAppend(conds, mode) {
    const clean = (c) => String(c).replace(/\s+/g, " ").trim();
    const joined = mode === "exclude" ? conds.map(clean).filter(Boolean).map(ensureNeg).filter(Boolean).join(" && ") : joinIncludeBatch("", conds);
    if (!joined) return;
    if (!document.getElementById("fofa-toolbox-box")) openToolbox(false, "edit");
    if (!editMain) return;
    editMain.insertPreset(joined);
    importToast(mode === "exclude" ? `${ic("ok")} 已作为排除卡并入查询编辑器（可在编辑器里继续调整）` : `${ic("ok")} 已并入查询编辑器（同字段多值已并列成或卡，可继续调整）`);
  }
  function openTab(query) {
    const url = `${location.origin}/result?qbase64=${encodeURIComponent(b64enc(query))}`;
    if (openInCurrent()) {
      location.assign(url);
      return;
    }
    const w = typeof unsafeWindow !== "undefined" && unsafeWindow || window;
    try {
      if (w.open(url, "_blank")) return;
    } catch (e) {
    }
    if (typeof GM_openInTab === "function") GM_openInTab(url, { active: true });
    else window.open(url, "_blank");
  }
  function fallbackCopy(s, done) {
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch (e) {
    }
    ta.remove();
  }
  function copyText(s, btn) {
    const done = () => {
      const old = btn.textContent;
      btn.textContent = "✓";
      setTimeout(() => {
        btn.textContent = old;
      }, 1200);
    };
    if (typeof GM_setClipboard === "function") {
      GM_setClipboard(s);
      done();
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).then(done).catch(() => fallbackCopy(s, done));
    } else {
      fallbackCopy(s, done);
    }
  }
  let menu = null;
  function hideMenu() {
    if (menu) {
      menu.remove();
      menu = null;
    }
  }
  function orCompose(cur, cond) {
    const row = parseCondOne(cond);
    const cards = parseQueryToCards(cur || "");
    const tgt = row && row.field && cards.find((c) => c.raw == null && c.field.toLowerCase() === row.field.toLowerCase() && c.join === "||");
    if (!tgt) return cur ? `(${cur}) || ${cond}` : cond;
    if (!tgt.rows.some((r) => r.op === row.op && r.value === row.value)) tgt.rows.push({ op: row.op, value: row.value });
    return cardsToQuery(cards);
  }
  function showMenu(x, y, cand) {
    hideMenu();
    injectStyle();
    menu = document.createElement("div");
    menu.id = "fofa-toolbox-menu";
    menu.innerHTML = `
    <input class="fx-cond" spellcheck="false" placeholder='例如 product="HIKVISION-视频监控" 或 icon_hash="-1940193079"'>
    <div class="fx-btns">
      <button class="fx-primary" title="将该条件取反后追加到当前语句，并在新标签页打开">${ic("exclude")} 排除并打开</button>
      <button class="fx-inc" title="将该条件以 且(&amp;&amp;) 追加到当前语句，并在新标签页打开">${ic("include")} 且包含</button>
      <button class="fx-or" title="将该条件以 或(||) 并入当前语句：优先并入语句里同字段的或组（括号内，与其他同类条件并列），没有可并的或组时把当前语句整体括起来再或">${ic("includeOr")} 或包含</button>
    </div>
    <div class="fx-btns">
      <button class="fx-eedit-ex" title="把该条件取反后作为字段卡并入查询编辑器（同字段自动集中一卡、去重；工具箱没开会自动打开），不新开标签">${ic("exclude")}${ic("edit")} 排除到编辑器</button>
      <button class="fx-eedit-in" title="把该条件作为字段卡并入查询编辑器（同字段自动集中一卡、去重；工具箱没开会自动打开），不新开标签">${ic("include")}${ic("edit")} 包含到编辑器</button>
    </div>
    <div class="fx-foot">
      <label class="fx-curwin" title="勾选后在当前标签页内跳转，不再新开标签"><input type="checkbox">在本页打开</label>
      <span title="按住 Alt 用左键拖拽出一块区域，批量识别其中可排除的对象">${ic("rubber")} Alt+拖拽=框选批量</span><span>v${VER}</span>
    </div>`;
    const input = menu.querySelector(".fx-cond");
    input.value = cand.cond;
    let edited = false;
    input.addEventListener("input", () => {
      edited = true;
    });
    const curwin = menu.querySelector(".fx-curwin input");
    curwin.checked = openInCurrent();
    curwin.addEventListener("change", () => {
      try {
        sessionStorage.setItem(CURWIN_KEY, curwin.checked ? "1" : "0");
      } catch (e) {
      }
    });
    const getCond = () => input.value.replace(/\s+/g, " ").trim();
    const compose = (cond, mode) => {
      if (!cand.cur) return cond;
      if (mode === "exclude" && cand.replace && !edited) return cand.cur.replace(cand.replace, cond);
      if (mode === "or") return orCompose(cand.cur, cond);
      return `${cand.cur} && ${cond}`;
    };
    if (cand.replace) {
      const btn = menu.querySelector(".fx-primary");
      btn.title = "当前语句已包含此条件：把它就地取反后打开（而非追加）";
    }
    console.info(`[FOFA工具箱] v${VER} 右键菜单：cur长度=${(cand.cur || "").length}，replace=${cand.replace || "无"}，cond=${cand.cond}`);
    const doOpen = (mode) => {
      const cond = getCond();
      if (!cond) {
        input.focus();
        return;
      }
      const final = mode === "exclude" ? ensureNeg(cond) : !edited && cand.include ? cand.include : ensurePos(cond);
      const q = compose(final, mode);
      const label = mode === "exclude" ? "排除" : mode === "or" ? "或包含" : "且包含";
      console.info(`[FOFA工具箱] v${VER} ${label} -> ${q}`);
      openTab(q);
      hideMenu();
    };
    menu.querySelector(".fx-primary").addEventListener("click", () => doOpen("exclude"));
    menu.querySelector(".fx-inc").addEventListener("click", () => doOpen("include"));
    menu.querySelector(".fx-or").addEventListener("click", () => doOpen("or"));
    const doEdit = (mode) => {
      const cond = getCond();
      if (!cond) {
        input.focus();
        return;
      }
      const final = mode === "exclude" ? ensureNeg(cond) : !edited && cand.include ? cand.include : ensurePos(cond);
      console.info(`[FOFA工具箱] v${VER} ${mode === "exclude" ? "排除" : "包含"}到编辑器 -> ${final}`);
      editorAppend([final], mode);
      hideMenu();
    };
    menu.querySelector(".fx-eedit-ex").addEventListener("click", () => doEdit("exclude"));
    menu.querySelector(".fx-eedit-in").addEventListener("click", () => doEdit("include"));
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        doOpen("exclude");
      }
    });
    document.documentElement.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + "px";
    menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + "px";
    input.focus();
    if (cand.cond) input.select();
  }
  const currentQuery = () => queryFromUrl(location.href);
  function firstText(el) {
    if (!el) return "";
    const attr = el.getAttribute && (el.getAttribute("title") || el.getAttribute("alt"));
    const raw = attr || el.innerText || el.textContent || "";
    return raw.split("\n").map((s) => s.trim()).filter(Boolean)[0] || "";
  }
  function countryFromFlag(t) {
    const img = t.closest ? t.closest('img.hsxa-country-img, img[alt="country"]') : null;
    if (!img) return null;
    let box = img.parentElement;
    for (let i = 0; i < 4 && box; i++, box = box.parentElement) {
      for (const a of box.querySelectorAll('a[href*="qbase64="]')) {
        const lq = queryFromUrl(a.href);
        if (!lq) continue;
        const cond = extractNew(lq, currentQuery());
        if (cond && /^\s*country\s*=/i.test(cond)) return cond;
        const m = /(^|&&\s*)country\s*=\s*("[^"]*"|\S+)/.exec(lq);
        if (m) return `country=${m[2]}`;
      }
    }
    box = img.parentElement;
    for (let i = 0; i < 3 && box; i++, box = box.parentElement) {
      for (const a of box.querySelectorAll("a")) {
        const code = NAME2CODE[(a.textContent || "").trim().toLowerCase()];
        if (code) return `country="${code}"`;
      }
    }
    return null;
  }
  function serverFromIcon(t) {
    const icon = t.closest ? t.closest('span.hsxa-server-icon, span[class*="server-icon"]') : null;
    if (!icon) return null;
    const a = icon.closest("a") || icon.parentElement;
    const txt = firstText(a).slice(0, MAX_TEXT_LEN);
    return txt ? `server="${txt}"` : null;
  }
  function vueWalkMatch(match) {
    try {
      const w = typeof unsafeWindow !== "undefined" && unsafeWindow || window;
      const doc = w.document;
      const wrap = doc && doc.querySelector && doc.querySelector(".similar-icons-wrapper");
      if (!wrap) return null;
      let container = null;
      for (let n = wrap; n; n = n.parentElement) {
        if (n.__vue_app__) {
          container = n.__vue_app__._container || n;
          break;
        }
      }
      const root = container && container._vnode;
      if (!root) return null;
      let visited = 0;
      const walk = (vnode, depth) => {
        if (!vnode || typeof vnode !== "object" || depth > 100 || visited > 6e3) return void 0;
        const inst = vnode.component;
        if (inst) {
          visited++;
          let se = inst.subTree && inst.subTree.el;
          if (se && (se.nodeType === 3 || se.nodeType === 8)) se = se.parentElement;
          if (se && se.querySelectorAll && se.contains(wrap)) {
            const r = match(inst, se);
            if (r !== null && r !== void 0) return r;
          }
          return walk(inst.subTree, depth + 1);
        }
        if (vnode.suspense && vnode.suspense.activeBranch) return walk(vnode.suspense.activeBranch, depth + 1);
        if (Array.isArray(vnode.children)) {
          for (const c of vnode.children) {
            if (c && typeof c === "object") {
              const r = walk(c, depth + 1);
              if (r !== null && r !== void 0) return r;
            }
          }
        }
        return void 0;
      };
      return walk(root, 0);
    } catch (e) {
      return null;
    }
  }
  function iconFromSidebar(t) {
    const img = t.closest ? t.closest(".icon-item-wrapper img, .icon_hash-icon-list img, .similar-icons-wrapper img") : null;
    if (!img) return null;
    const m = /base64,([A-Za-z0-9+/=]+)/.exec(img.src || "");
    if (!m) return null;
    const b64 = m[1];
    const hit = vueWalkMatch((inst, se) => {
      if (!se.querySelector(".icon_hash-icon-list")) return null;
      const p = inst.props || {};
      if (p.keyWord !== "icon_hash" || !Array.isArray(p.items)) return null;
      for (const it of p.items) {
        if (it && typeof it === "object" && it.key !== void 0 && typeof it.imageBase64 === "string" && it.imageBase64.length >= 64 && it.imageBase64.slice(0, 64) === b64.slice(0, 64)) {
          return String(it.key);
        }
      }
      return null;
    });
    return hit ? `icon_hash="${hit}"` : null;
  }
  function countryFromMap(t) {
    const canvas = t.closest ? t.closest(".hsxa-result-map canvas, .echarts canvas") : null;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const tips = [...document.querySelectorAll("div")].filter((d) => {
      if (!d.offsetWidth || d.offsetHeight > 120) return false;
      const s = getComputedStyle(d);
      if (s.position !== "absolute" || s.visibility === "hidden" || parseFloat(s.opacity || "1") === 0) return false;
      const r = d.getBoundingClientRect();
      if (!(r.x < rect.right + 100 && r.right > rect.left - 100 && r.y < rect.bottom + 150 && r.bottom > rect.top - 150)) return false;
      const txt = (d.textContent || "").trim();
      return txt.length > 0 && txt.length <= 100;
    });
    for (const d of tips) {
      const first = (d.innerText || d.textContent || "").split("\n").map((x) => x.trim()).filter(Boolean)[0] || "";
      const name = first.split(/[:：]/)[0].replace(/[0-9,，.\s]+$/, "").trim();
      if (!name) continue;
      if (/^[A-Za-z]{2}$/.test(name)) return `country="${name.toUpperCase()}"`;
      const code = NAME2CODE[name.toLowerCase()];
      if (code) return `country="${code}"`;
    }
    return null;
  }
  function hostIpFromText(text) {
    const t = String(text || "").replace(/\s+/g, "");
    if (!t) return null;
    let m = /^((?:\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])(?:\.(?:\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])){3})(?::(\d{1,5}))?$/.exec(t);
    if (m) return `ip="${m[1]}"`;
    m = /^\[([0-9a-fA-F:]+)\](?::(\d{1,5}))?$/.exec(t);
    if (m) return `ip="${m[1]}"`;
    m = /^([0-9a-fA-F]*:[0-9a-fA-F:]*[0-9a-fA-F])(?::(\d{1,5}))?$/.exec(t);
    if (m && m[1].includes("::")) return `ip="${m[1]}"`;
    return null;
  }
  function hostFromSpan(t) {
    const sp = t.closest ? t.closest("span.hsxa-host") : null;
    if (!sp) return null;
    return hostIpFromText(sp.textContent);
  }
  function findCandidate(e) {
    const t = e.target;
    if (!(t instanceof Element)) return null;
    if (menu && menu.contains(t)) return null;
    if (e.shiftKey) return null;
    const cur = currentQuery();
    const link = t.closest('a[href*="qbase64="]');
    if (link) {
      const lq = queryFromUrl(link.href);
      if (lq) {
        const cond = extractNew(lq, cur);
        if (cond) return { cur, cond: negate(cond) || cond, include: cond };
        if (cur) {
          const self = selfCondition(lq, firstText(link));
          if (self) {
            const replace = condInQuery(cur, self) ? self : null;
            return { cur, cond: negate(self) || self, include: self, replace };
          }
        }
      }
    }
    const country = countryFromFlag(t);
    if (country) return { cur, cond: negate(country) || country, include: country };
    const mapCountry = countryFromMap(t);
    if (mapCountry) return { cur, cond: negate(mapCountry) || mapCountry, include: mapCountry };
    const server = serverFromIcon(t);
    if (server) return { cur, cond: negate(server) || server, include: server };
    const sidebarIcon = iconFromSidebar(t);
    if (sidebarIcon) return { cur, cond: negate(sidebarIcon) || sidebarIcon, include: sidebarIcon };
    const hostIp = hostFromSpan(t);
    if (hostIp) return { cur, cond: negate(hostIp) || hostIp, include: hostIp };
    const st = (window.getSelection ? String(window.getSelection()) : "").trim();
    if (st && st.length <= 120) {
      const low = st.toLowerCase();
      const code = NAME2CODE[low];
      if (code) return { cur, cond: `country!="${code}"`, include: `country="${code}"` };
      if (PROTO_SET.has(low)) return { cur, cond: `protocol!="${low}"`, include: `protocol="${low}"` };
      return { cur, cond: `product!="${st}"`, include: `product="${st}"` };
    }
    return null;
  }
  function scanLeaves(q) {
    const leaves = [];
    const text = balanceParens(String(q || ""));
    const isWs = (c) => /\s/.test(c);
    const trim = (lo, hi) => {
      while (lo < hi && isWs(text[lo])) lo++;
      while (hi > lo && isWs(text[hi - 1])) hi--;
      return [lo, hi];
    };
    const peel = (lo0, hi0) => {
      let lo = lo0, hi = hi0;
      for (; ; ) {
        [lo, hi] = trim(lo, hi);
        if (text[lo] !== "(" || text[hi - 1] !== ")") break;
        let depth = 0, inStr = false, wraps = true;
        for (let i = lo; i < hi; i++) {
          const c = text[i];
          if (inStr) {
            if (c === '"') inStr = false;
            continue;
          }
          if (c === '"') {
            inStr = true;
            continue;
          }
          if (c === "(") depth++;
          else if (c === ")") {
            if (depth > 0) depth--;
            if (depth === 0 && i < hi - 1) {
              wraps = false;
              break;
            }
          }
        }
        if (!wraps || depth !== 0) break;
        lo++;
        hi--;
      }
      return [lo, hi];
    };
    const splitAt = (lo0, hi0, sep) => {
      let lo = lo0, hi = hi0;
      [lo, hi] = trim(lo, hi);
      const parts = [];
      let depth = 0, inStr = false, start = lo;
      for (let i = lo; i < hi; i++) {
        const c = text[i];
        if (inStr) {
          if (c === '"') inStr = false;
          continue;
        }
        if (c === '"') {
          inStr = true;
          continue;
        }
        if (c === "(") {
          depth++;
          continue;
        }
        if (c === ")") {
          if (depth > 0) depth--;
          continue;
        }
        if (depth === 0 && c === sep && text[i + 1] === sep) {
          parts.push(trim(start, i));
          i++;
          start = i + 1;
        }
      }
      parts.push(trim(start, hi));
      return parts.filter((p) => p[0] < p[1]);
    };
    const pushLeaf = (lo, hi) => {
      const row = parseCondOne(text.slice(lo, hi));
      if (row) leaves.push({ start: lo, end: hi, field: row.field, op: row.op, value: row.value });
      else leaves.push({ start: lo, end: hi, raw: true });
    };
    const walkSeg = (lo0, hi0, ov) => {
      const [plo, phi] = peel(lo0, hi0);
      const alts = splitAt(plo, phi, "|");
      if (!alts.length) return;
      const [tlo, thi] = ov ? [ov[0], ov[1]] : trim(lo0, hi0);
      if (alts.length === 1) {
        pushLeaf(alts[0][0], alts[0][1]);
        const lf = leaves[leaves.length - 1];
        if (lf && !lf.raw) {
          lf.start = Math.min(lf.start, tlo);
          lf.end = Math.max(lf.end, thi);
          return;
        }
        leaves.pop();
        const subs = splitAt(plo, phi, "&");
        if (subs.length > 1) {
          subs.forEach((s) => walkSeg(s[0], s[1]));
          return;
        }
        leaves.push({ start: tlo, end: thi, raw: true });
        return;
      }
      const rows = alts.map((a) => parseCondOne(text.slice(a[0], a[1])));
      if (rows.every((r) => r && r.field && r.field.toLowerCase() === rows[0].field.toLowerCase())) {
        alts.forEach((a, i) => leaves.push({ start: a[0], end: a[1], field: rows[i].field, op: rows[i].op, value: rows[i].value }));
        const f0 = leaves[leaves.length - alts.length];
        const l0 = leaves[leaves.length - 1];
        f0.start = Math.min(f0.start, tlo);
        l0.end = Math.max(l0.end, thi);
      } else {
        leaves.push({ start: tlo, end: thi, raw: true });
      }
    };
    splitAt(0, text.length, "&").forEach((sp) => {
      const [plo, phi] = peel(sp[0], sp[1]);
      const segs = splitAt(plo, phi, "&");
      const [ptlo, pthi] = trim(sp[0], sp[1]);
      const hadWrap = ptlo !== plo || pthi !== phi;
      segs.forEach((t) => {
        const n0 = leaves.length;
        walkSeg(t[0], t[1], hadWrap && segs.length === 1 ? [ptlo, pthi] : null);
        if (hadWrap && segs.length === 1 && leaves.length === n0 + 1 && leaves[n0].raw) {
          leaves[n0].start = ptlo;
          leaves[n0].end = pthi;
        }
      });
    });
    return leaves;
  }
  function cardTextSpans(cards, q) {
    const leaves = scanLeaves(q);
    const seen = /* @__PURE__ */ new Map();
    for (const lf of leaves) {
      if (lf.raw) continue;
      const k = (lf.field || "").toLowerCase();
      lf.seq = seen.get(k) || 0;
      seen.set(k, lf.seq + 1);
    }
    const cardSpan = [];
    const rowSeq = /* @__PURE__ */ new Map();
    let rawIdx = 0;
    const rawLeaves = leaves.filter((l) => l.raw);
    (cards || []).forEach((c, ci) => {
      if (c.raw != null) {
        const lf = rawLeaves[rawIdx++];
        if (lf) {
          lf.ci = ci;
          lf.ri = -1;
          cardSpan[ci] = { start: lf.start, end: lf.end };
        }
        return;
      }
      let un = null;
      (c.rows || []).forEach((r, ri) => {
        const k = c.field.toLowerCase();
        const seq = rowSeq.get(k) || 0;
        rowSeq.set(k, seq + 1);
        const lf = leaves.find((l) => !l.raw && (l.field || "").toLowerCase() === k && l.seq === seq);
        if (!lf) return;
        lf.ci = ci;
        lf.ri = ri;
        un = un ? { start: Math.min(un.start, lf.start), end: Math.max(un.end, lf.end) } : { start: lf.start, end: lf.end };
      });
      if (un) cardSpan[ci] = un;
    });
    return {
      leafAt: (off) => {
        for (const lf of leaves) {
          if (lf.ci !== void 0 && lf.start <= off && off < lf.end) return { ci: lf.ci, ri: lf.ri };
        }
        return null;
      },
      spanOfCard: (ci) => cardSpan[ci] || null
    };
  }
  let editorSeq = 0;
  function editorShellHtml(sfx, preset) {
    if (preset) return `
    <div class="fx-e-cards"></div>
    <div class="fx-e-adds">
      <button class="fx-e-andb" title="新增一张字段卡">${ic("add")} 字段卡</button>
      <button class="fx-e-orb" title="在焦点卡追加一个值，继承运算符">${ic("plus")} 值</button>
    </div>
    <textarea class="fx-e-qtext" spellcheck="false" title="预设搜索串（可直接编辑）：改动实时解析成上方字段卡；卡片侧的改动也实时回写到这里。括号不配对会自动补全；支持 TAB 补齐（字段/运算符/布尔·协议·日期值）" placeholder="预设搜索串（可直接编辑，与上方卡片实时互通）"></textarea>
    <div class="fx-e-pactions">
      <button class="fx-e-psave2" title="把当前内容写回该预设的搜索串">${ic("save")} 保存到预设</button>
      <button class="fx-e-ccollapse" title="收起编辑（未保存的改动会丢弃）">收起</button>
    </div>`;
    return `
    <div class="fx-e-quick">
      <button class="fx-e-qmonth" title="切换 after=一月内条件（再点一次移除，月末钳制）">${ic("time")} 一个月内</button>
      <button class="fx-e-qcloud" title="切换 is_cloud=&quot;false&quot; 排除云服务（兼容识别 is_cloude 写法；再点一次移除）">${ic("cloud")} 排除云服务</button>
      <button class="fx-e-reload" title="读入当前页面的查询语句（编辑器已有内容会先询问），之后恢复自动跟随页面语句">${ic("refresh")} 使用当前查询语句</button>
      <button class="fx-e-blank" title="清空编辑器从零组装（已有内容会先询问）；此后不再自动跟随页面语句">${ic("blank")} 新建空白查询</button>
      <button class="fx-e-savefp" title="把当前语句存入指纹库（自动填名称/产品/收录时间）">${ic("lib")} 存为指纹</button>
      <button class="fx-e-pbtn" title="展开/收起预设快插列表">${ic("preset")} 预设</button>
    </div>
    <div class="fx-e-pbox" style="display:none">
      <div class="fx-e-prow">
        <input class="fx-e-pname" placeholder="预设名称，如：地区-中亚" spellcheck="false">
        <button class="fx-e-psave" title="保存为预设：焦点行存单条条件，焦点卡存整卡，无焦点存整条语句">${ic("save")} 存为预设</button>
      </div>
      <div class="fx-e-plist"></div>
    </div>
    <div class="fx-e-cards"></div>
    <div class="fx-e-adds">
      <button class="fx-e-andb" title="新增一张字段卡（Alt+A）">${ic("add")} 字段卡 Alt+A</button>
      <button class="fx-e-orb" title="在焦点卡追加一个值，继承运算符（Alt+O）">${ic("plus")} 值 Alt+O</button>
    </div>
    <textarea class="fx-e-qtext" spellcheck="false" title="查询语句（可直接编辑）：改动实时解析成上方字段卡；卡片侧的改动也会实时回写到这里。括号不配对会自动补全。单击语句中的条件可定位上方对应卡片" placeholder="查询语句（可直接编辑，与上方卡片实时互通）——回车搜索，Shift+回车换行"></textarea>
    <div class="fx-e-actions">
      <button class="fx-e-search" title="按当前语句发起查询（编辑器内回车同）">${ic("search")} 搜索</button>
      <button class="fx-e-copy" title="复制当前语句">${ic("copy")} 复制</button>
    </div>`;
  }
  function createEditor(pane, sfx) {
    const st = { cards: [], focus: null, lastParsed: null, loaded: false, hlCi: null };
    const qtext = pane.querySelector(".fx-e-qtext");
    const cardsEl = pane.querySelector(".fx-e-cards");
    function renderCards() {
      if (!cardsEl) return;
      if (!st.cards.length) {
        cardsEl.innerHTML = '<div class="fx-e-empty">（无条件）：直接在下方语句框输入，或点上方快速开关 / 预设，或 Alt+A 添加字段卡</div>';
        applyHl(st.hlCi);
        return;
      }
      let html = "";
      st.cards.forEach((c, ci) => {
        if (c.raw != null) {
          html += `<div class="fx-e-group" data-ci="${ci}">
          <div class="fx-e-chead"><span class="fx-e-tag">原样片段</span><span class="fx-e-cops"><b class="fx-e-cdel" title="删除此卡">${ic("close")}</b></span></div>
          <div class="fx-e-row"><input class="raw" data-ci="${ci}" data-ri="0" data-f="raw" value="${esc(c.raw)}" spellcheck="false"></div>
        </div>`;
          return;
        }
        const or = c.join === "||" && (c.rows || []).length > 1;
        html += `<div class="fx-e-group${or ? " or" : ""}" data-ci="${ci}">
        <div class="fx-e-chead">
          <input class="fx-e-cfld" data-ci="${ci}" data-f="field" value="${esc(c.field)}" placeholder="字段（留空=关键词）" spellcheck="false" title="字段名，如 country / product / icon_hash；输入时 TAB 补齐">
          <select class="fx-e-cjoin" data-ci="${ci}" data-f="join" title="卡内多值如何拼接">
            <option value="&&"${c.join === "&&" ? " selected" : ""}>且 &&</option>
            <option value="||"${c.join === "||" ? " selected" : ""}>或 ||</option>
          </select>
          <span class="fx-e-tag">${or ? "( 或卡自动加括号 )" : (c.rows || []).length + " 值"}</span>
          <span class="fx-e-cops"><b class="fx-e-cadd" title="在本卡追加一个值（Alt+O）">${ic("plus")}值</b><b class="fx-e-cdel" title="删除整卡">${ic("close")}</b></span>
        </div>`;
        (c.rows || []).forEach((r, ri) => {
          const conn = ri === 0 ? "" : c.join === "||" ? '<span class="fx-e-or">‖ 或</span>' : '<span class="fx-e-rowand">且 &&</span>';
          html += `<div class="fx-e-row">${conn}
          <select data-ci="${ci}" data-ri="${ri}" data-f="op" title="运算符">
            <option value="="${r.op === "=" ? " selected" : ""}>模糊 =</option>
            <option value="=="${r.op === "==" ? " selected" : ""}>精确 ==</option>
            <option value="!="${r.op === "!=" ? " selected" : ""}>排除 !=</option>
          </select>
          <input class="val" data-ci="${ci}" data-ri="${ri}" data-f="value" value="${esc(r.value)}" spellcheck="false" placeholder="值" title="值；布尔/协议/日期字段输入时 TAB 补齐">
          <b class="fx-e-rdel" data-ci="${ci}" data-ri="${ri}" title="删除此值">${ic("close")}</b>
        </div>`;
        });
        html += "</div>";
      });
      cardsEl.innerHTML = html;
      applyHl(st.hlCi);
    }
    function updateState(fromText) {
      const q = cardsToQuery(st.cards);
      if (qtext && !fromText && qtext.value !== q) qtext.value = q;
      const hasField = (name) => st.cards.some((c) => c.raw == null && c.field.toLowerCase() === name);
      const mb = pane.querySelector(".fx-e-qmonth");
      if (mb) mb.classList.toggle("on", hasField("after"));
      const cb = pane.querySelector(".fx-e-qcloud");
      if (cb) cb.classList.toggle("on", hasField("is_cloud") || hasField("is_cloude"));
      const sb = pane.querySelector(".fx-e-search");
      if (sb) {
        sb.disabled = !q;
        sb.style.opacity = q ? "" : ".5";
      }
    }
    function refresh(fromText) {
      renderCards();
      updateState(fromText);
    }
    function applyHl(ci) {
      st.hlCi = ci;
      if (!cardsEl) return;
      cardsEl.querySelectorAll(".fx-e-group").forEach((g) => g.classList.toggle("fx-e-hl", ci != null && +g.dataset.ci === ci));
    }
    function parseFromPage() {
      st.lastParsed = currentQuery();
      st.loaded = false;
      st.cards = parseQueryToCards(st.lastParsed);
      st.focus = null;
      applyHl(null);
      refresh();
    }
    function loadQuery(q) {
      st.cards = parseQueryToCards(q || "");
      st.focus = null;
      st.loaded = true;
      applyHl(null);
      refresh();
    }
    function insertPreset(content) {
      st.cards = mergeCards(st.cards, parseQueryToCards(content));
      st.focus = null;
      refresh();
    }
    function toggleQuick(kind) {
      const isIt = (c) => c.raw == null && (kind === "month" ? c.field.toLowerCase() === "after" : c.field.toLowerCase() === "is_cloud" || c.field.toLowerCase() === "is_cloude");
      if (st.cards.some(isIt)) st.cards = st.cards.filter((c) => !isIt(c));
      else if (kind === "month") st.cards.push({ field: "after", join: "&&", rows: [{ op: "=", value: monthAgoOf(/* @__PURE__ */ new Date()) }] });
      else st.cards.push({ field: "is_cloud", join: "&&", rows: [{ op: "=", value: "false" }] });
      st.focus = null;
      refresh();
    }
    function focusCell(ci, ri, which) {
      const el = pane.querySelector(`[data-ci="${ci}"][data-ri="${ri}"][data-f="${which}"]`);
      if (el) el.focus();
    }
    function addItem(kind) {
      if (kind === "row" && st.cards.length) {
        const fc = st.focus && st.cards[st.focus.ci];
        const ci2 = fc ? st.focus.ci : st.cards.length - 1;
        const card2 = st.cards[ci2];
        if (card2 && card2.raw == null) {
          const ref = st.focus && st.focus.ri >= 0 && card2.rows[st.focus.ri] || card2.rows[card2.rows.length - 1];
          card2.rows.push({ op: ref ? ref.op : "=", value: "" });
          refresh();
          focusCell(ci2, card2.rows.length - 1, "value");
          return;
        }
      }
      const card = { field: "", join: "&&", rows: [{ op: "=", value: "" }] };
      let ci = st.cards.length;
      if (st.focus && st.cards[st.focus.ci]) ci = st.focus.ci + 1;
      st.cards.splice(ci, 0, card);
      refresh();
      const fld = pane.querySelector(`.fx-e-cfld[data-ci="${ci}"]`);
      if (fld) fld.focus();
    }
    if (qtext) {
      qtext.addEventListener("input", () => {
        st.cards = parseQueryToCards(qtext.value);
        st.focus = null;
        applyHl(null);
        renderCards();
        updateState(true);
      });
      qtext.addEventListener("blur", () => {
        const q = cardsToQuery(st.cards);
        if (qtext.value !== q) qtext.value = q;
      });
      qtext.addEventListener("click", () => {
        const m = cardTextSpans(st.cards, qtext.value).leafAt(qtext.selectionStart);
        if (!m) return;
        st.focus = { ci: m.ci, ri: m.ri };
        applyHl(m.ci);
        const g = cardsEl && cardsEl.querySelector(`.fx-e-group[data-ci="${m.ci}"]`);
        if (g) g.scrollIntoView({ block: "nearest" });
      });
      qtext.addEventListener("focus", () => acFocus(qtext));
      qtext.addEventListener("blur", acHide);
      qtext.addEventListener("keydown", acKeydown);
      qtext.addEventListener("input", acRefresh);
      qtext.addEventListener("keyup", acRefresh);
      qtext.addEventListener("click", acRefresh);
    }
    if (cardsEl) {
      cardsEl.addEventListener("input", (e) => {
        const el = e.target;
        if (!el.dataset || el.dataset.ci === void 0) return;
        const card = st.cards[+el.dataset.ci];
        if (!card) return;
        if (el.dataset.f === "raw") card.raw = el.value;
        else if (el.dataset.f === "field") card.field = el.value.trim().toLowerCase();
        else if (el.dataset.f === "value") {
          const row = card.rows && card.rows[+el.dataset.ri];
          if (row) row.value = el.value;
        }
        updateState();
      });
      cardsEl.addEventListener("change", (e) => {
        const el = e.target;
        if (!el.dataset || el.dataset.ci === void 0) return;
        const card = st.cards[+el.dataset.ci];
        if (!card) return;
        if (el.dataset.f === "op") {
          const row = card.rows && card.rows[+el.dataset.ri];
          if (row) {
            row.op = el.value;
            updateState();
          }
        } else if (el.dataset.f === "join") {
          card.join = el.value;
          refresh();
        }
      });
      cardsEl.addEventListener("focusin", (e) => {
        if (!e.target.dataset || e.target.dataset.ci === void 0) return;
        st.focus = { ci: +e.target.dataset.ci, ri: e.target.dataset.ri === void 0 ? -1 : +e.target.dataset.ri };
        applyHl(st.focus.ci);
        if (!qtext) return;
        const sp = cardTextSpans(st.cards, qtext.value).spanOfCard(st.focus.ci);
        if (sp) qtext.setSelectionRange(sp.start, sp.end);
      });
      cardsEl.addEventListener("click", (e) => {
        const rd = e.target.closest && e.target.closest(".fx-e-rdel");
        if (rd) {
          const ci = +rd.dataset.ci;
          const card = st.cards[ci];
          if (card && card.rows) {
            card.rows.splice(+rd.dataset.ri, 1);
            if (!card.rows.length) st.cards.splice(ci, 1);
            st.focus = null;
            applyHl(null);
            refresh();
          }
          return;
        }
        const cd = e.target.closest && e.target.closest(".fx-e-cdel");
        if (cd) {
          st.cards.splice(+cd.closest(".fx-e-group").dataset.ci, 1);
          st.focus = null;
          applyHl(null);
          refresh();
          return;
        }
        const ca = e.target.closest && e.target.closest(".fx-e-cadd");
        if (ca) {
          const ci = +ca.closest(".fx-e-group").dataset.ci;
          const card = st.cards[ci];
          if (card && card.raw == null) {
            const ref = card.rows[card.rows.length - 1];
            card.rows.push({ op: ref ? ref.op : "=", value: "" });
            refresh();
            focusCell(ci, card.rows.length - 1, "value");
          }
        }
      });
      const andb = pane.querySelector(".fx-e-andb");
      const orb = pane.querySelector(".fx-e-orb");
      if (andb) andb.addEventListener("click", () => addItem("card"));
      if (orb) orb.addEventListener("click", () => addItem("row"));
      cardsEl.addEventListener("focusin", (e) => {
        const t = acTarget(e.target);
        if (t) acFocus(t);
      });
      cardsEl.addEventListener("focusout", acHide);
      cardsEl.addEventListener("input", acRefresh);
      cardsEl.addEventListener("keyup", acRefresh);
      cardsEl.addEventListener("click", acRefresh);
      cardsEl.addEventListener("keydown", acKeydown);
    }
    refresh();
    return {
      pane,
      parseFromPage,
      loadQuery,
      insertPreset,
      toggleQuick,
      addItem,
      getQuery: () => cardsToQuery(st.cards),
      focusInfo: () => st.focus && st.cards[st.focus.ci] ? { card: st.cards[st.focus.ci], ri: st.focus.ri } : null,
      pageChanged: () => !st.loaded && currentQuery() !== st.lastParsed
    };
  }
  function nextEditorSeq() {
    return ++editorSeq;
  }
  const PRESET_KEY = "fofa-toolbox-presets";
  function loadPresets() {
    try {
      const a = JSON.parse(localStorage.getItem(PRESET_KEY) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }
  function savePresets(arr) {
    try {
      localStorage.setItem(PRESET_KEY, JSON.stringify(arr));
      return true;
    } catch (e) {
      return false;
    }
  }
  function closePresetMgr() {
    const el = document.getElementById("fofa-preset-mgr");
    if (el) el.remove();
  }
  function mergePresets(raws, arr) {
    const ids = new Set(arr.map((x) => x.id));
    const key = (p) => String(p.name || "").trim() + "\0" + String(p.content || "").replace(/\s+/g, " ").trim();
    const seen = new Set(arr.map(key));
    const list = arr.slice();
    let added = 0, skipped = 0;
    for (const raw of raws) {
      if (!raw || typeof raw !== "object") continue;
      const it = {
        name: String(raw.name == null ? "" : raw.name).trim(),
        content: String(raw.content == null ? "" : raw.content).trim(),
        group: String(raw.group == null ? "" : raw.group).trim(),
        ts: String(raw.ts == null ? "" : raw.ts)
      };
      if (!it.name && !it.content) {
        skipped++;
        continue;
      }
      if (seen.has(key(it))) {
        skipped++;
        continue;
      }
      let id = Number(raw.id);
      if (!raw.id || !Number.isFinite(id) || ids.has(id)) {
        do {
          id = Date.now() + Math.floor(Math.random() * 1e6);
        } while (ids.has(id));
      }
      it.id = id;
      ids.add(id);
      seen.add(key(it));
      list.push(it);
      added++;
    }
    return { list, added, skipped };
  }
  function presetMgrFiltered(filter) {
    const kw = String(filter || "").trim().toLowerCase();
    const hit = (p) => !kw || [p.name, p.content, p.group].some((v) => String(v || "").toLowerCase().includes(kw));
    return loadPresets().filter(hit);
  }
  function renderPresetMgr() {
    const el = document.getElementById("fofa-preset-mgr");
    if (!el) return;
    const all = loadPresets();
    const list = presetMgrFiltered(el.dataset.filter);
    const groups = groupList(list, (p) => p.group);
    const editingId = el.dataset.editing || "";
    const showHeads = groups.length > 1 || groups.some((g) => g.group);
    const NC = 5;
    let rows = "";
    for (const g of groups) {
      if (showHeads) rows += `<tr class="fx-l-ghead"><td colspan="${NC}">${ic("folder")} ${esc(g.group || "未分组")}<span>${g.items.length}</span></td></tr>`;
      for (const p of g.items) {
        rows += `<tr data-id="${p.id}"><td class="fx-rowdrag" draggable="true" title="拖动调整顺序（同组内）">${ic("drag")}</td>
        <td data-f="name" contenteditable="true" spellcheck="false">${esc(p.name || "")}</td>
        <td class="fx-l-mono fx-m-pcontent">${esc(p.content || "")}</td>
        <td data-f="group" contenteditable="true" spellcheck="false" title="分组（文件夹，一层；留空=未分组）">${esc(p.group || "")}</td>
        <td class="fx-l-ops"><b class="fx-m-pins" title="并入查询编辑器：同字段同拼接的卡自动合并去重">插入</b><b class="fx-m-povr" title="用此预设整条替换查询编辑器内容">覆盖</b><b class="fx-m-pedit" title="展开卡片编辑器修改搜索串">${ic("edit")} 编辑</b><b class="fx-m-pdel" title="删除此预设">${ic("close")}</b></td></tr>`;
        if (editingId && String(p.id) === editingId) rows += `<tr class="fx-m-peditor"><td colspan="${NC}"></td></tr>`;
      }
    }
    el.querySelector(".fx-m-tablewrap").innerHTML = `<table class="fx-l-table">
    <thead><tr><th style="width:26px"></th><th style="width:130px">名称</th><th>搜索串</th><th style="width:90px">分组</th><th style="width:210px">操作</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="${NC}" class="fx-l-empty">暂无预设：点「${ic("add")} 新建」，或到查询编辑器里「${ic("save")} 存为预设」</td></tr>`}</tbody>
  </table>`;
    const cnt = el.querySelector(".fx-l-count");
    if (cnt) cnt.textContent = String(el.dataset.filter || "").trim() ? `共 ${all.length} 条，匹配 ${list.length} 条` : `共 ${all.length} 条`;
    if (editingId) mountPresetEditor(el.querySelector(".fx-m-peditor td"), all.find((p) => String(p.id) === editingId));
  }
  function mountPresetEditor(cell, preset) {
    if (!cell || !preset) return;
    const sfx = "p" + nextEditorSeq();
    cell.innerHTML = editorShellHtml(sfx, true);
    const ed = createEditor(cell);
    ed.loadQuery(preset.content || "");
    cell.querySelector(".fx-e-psave2").addEventListener("click", () => {
      const q = ed.getQuery();
      if (!q) {
        importToast(`${ic("warn")} 预设内容为空（要删除请回列表点 ${ic("close")}）`);
        return;
      }
      const arr = loadPresets();
      const it = arr.find((x) => String(x.id) === String(preset.id));
      if (it) {
        it.content = q;
        savePresets(arr);
      }
      const mgr = document.getElementById("fofa-preset-mgr");
      if (mgr) mgr.dataset.editing = "";
      renderPresetMgr();
      if (editMain) renderPresetQuickList(editMain.pane);
      importToast(`${ic("ok")} 预设搜索串已保存`);
    });
    cell.querySelector(".fx-e-ccollapse").addEventListener("click", () => {
      const mgr = document.getElementById("fofa-preset-mgr");
      if (mgr) mgr.dataset.editing = "";
      renderPresetMgr();
    });
  }
  function presetImport() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,application/json";
    inp.style.display = "none";
    inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      readImportText(f, (text) => {
        if (text == null) {
          importToast(`${ic("warn")} 导入失败：文件读取错误`);
          return;
        }
        let raws;
        try {
          raws = JSON.parse(String(text).replace(/^\ufeff/, ""));
        } catch (err) {
          importToast(`${ic("warn")} 导入失败：JSON 解析失败`);
          return;
        }
        if (!Array.isArray(raws)) {
          importToast(`${ic("warn")} 导入失败：JSON 内容不是预设数组`);
          return;
        }
        const res = mergePresets(raws, loadPresets());
        savePresets(res.list);
        renderPresetMgr();
        if (editMain) renderPresetQuickList(editMain.pane);
        importToast(`${ic("ok")} 预设导入：新增 <b>${res.added}</b> 条，跳过 <b>${res.skipped}</b> 条（名称+搜索串重复或整条为空）`);
      });
    });
    document.body.appendChild(inp);
    inp.click();
  }
  function openPresetMgr() {
    closePresetMgr();
    injectStyle();
    const el = document.createElement("div");
    el.id = "fofa-preset-mgr";
    el.dataset.filter = "";
    el.innerHTML = `
    <div class="fx-m-head">
      <span class="fx-m-title">${ic("presetMgr")} 管理预设</span>
      <input class="fx-m-search" placeholder="搜索：名称 / 搜索串 / 分组" spellcheck="false">
      <span class="fx-l-hbtns"><button class="fx-m-close" title="关闭（Esc）">关闭</button></span>
    </div>
    <div class="fx-m-tools">
      <span class="fx-l-count"></span>
      <button class="fx-m-add" title="新建预设：自动展开卡片编辑器，写好点「保存到预设」">${ic("add")} 新建</button>
      <button class="fx-m-expj" title="导出为 JSON 文件">导出 JSON</button>
      <button class="fx-m-impj" title="从 JSON 文件导入（按 名称+搜索串 去重合并）">导入</button>
    </div>
    <div class="fx-m-tablewrap"></div>`;
    el.querySelector(".fx-m-close").addEventListener("click", closePresetMgr);
    el.querySelector(".fx-m-search").addEventListener("input", (e) => {
      el.dataset.filter = e.target.value;
      renderPresetMgr();
    });
    el.querySelector(".fx-m-add").addEventListener("click", () => {
      const arr = loadPresets();
      const it = { id: Date.now() + Math.floor(Math.random() * 1e6), name: "新预设", content: "", group: "", ts: (/* @__PURE__ */ new Date()).toLocaleString() };
      arr.push(it);
      savePresets(arr);
      el.dataset.editing = String(it.id);
      renderPresetMgr();
      const nameCell = el.querySelector(`tbody tr[data-id="${it.id}"] td[data-f="name"]`);
      if (nameCell) nameCell.focus();
    });
    el.querySelector(".fx-m-expj").addEventListener("click", () => {
      downloadFile("fofa-toolbox-presets.json", JSON.stringify(loadPresets(), null, 2), "application/json");
    });
    el.querySelector(".fx-m-impj").addEventListener("click", presetImport);
    el.addEventListener("focusout", (e) => {
      const td = e.target.closest && e.target.closest("td[contenteditable][data-f]");
      if (!td) return;
      const tr = td.closest("tr");
      if (!tr || tr.dataset.id === void 0) return;
      const arr = loadPresets();
      const it = arr.find((x) => String(x.id) === tr.dataset.id);
      if (!it) return;
      it[td.dataset.f] = td.innerText.replace(/\u00a0/g, " ").trim();
      savePresets(arr);
      if (td.dataset.f === "group") renderPresetMgr();
      if (editMain) renderPresetQuickList(editMain.pane);
    });
    attachRowDrag(
      el,
      (a, b) => {
        const arr = loadPresets();
        const A = arr.find((x) => String(x.id) === a);
        const B = arr.find((x) => String(x.id) === b);
        return !!(A && B && String(A.group || "") === String(B.group || ""));
      },
      (id, targetId, before) => {
        const arr = loadPresets();
        const drag = arr.find((x) => String(x.id) === id);
        if (!drag) {
          renderPresetMgr();
          return;
        }
        arr.splice(arr.indexOf(drag), 1);
        const ti = arr.findIndex((x) => String(x.id) === targetId);
        if (ti < 0) {
          renderPresetMgr();
          return;
        }
        arr.splice(before ? ti : ti + 1, 0, drag);
        savePresets(arr);
        renderPresetMgr();
      }
    );
    el.addEventListener("click", (e) => {
      const hit = (cls) => e.target.closest && e.target.closest(cls);
      const row = hit(".fx-m-pins,.fx-m-povr,.fx-m-pedit,.fx-m-pdel");
      if (!row) return;
      const id = row.closest("tr").dataset.id;
      if (id === void 0) return;
      const p = loadPresets().find((x) => String(x.id) === id);
      if (!p) return;
      if (hit(".fx-m-pdel")) {
        savePresets(loadPresets().filter((x) => String(x.id) !== id));
        renderPresetMgr();
        if (editMain) renderPresetQuickList(editMain.pane);
        return;
      }
      if (hit(".fx-m-pedit")) {
        el.dataset.editing = el.dataset.editing === id ? "" : id;
        renderPresetMgr();
        return;
      }
      if (!document.getElementById("fofa-toolbox-box")) openToolbox(false, "edit");
      if (!editMain) return;
      if (hit(".fx-m-pins")) {
        editMain.insertPreset(p.content);
        importToast(`${ic("ok")} 已并入查询编辑器（同字段同拼接自动合并去重）`);
        return;
      }
      if (editMain.getQuery() && !window.confirm("编辑器里已有内容，用该预设整条覆盖？")) return;
      editMain.loadQuery(p.content);
      importToast(`${ic("ok")} 已用预设「<b>${esc(p.name)}</b>」覆盖编辑器内容`);
    });
    document.documentElement.appendChild(el);
    renderPresetMgr();
  }
  let editMain = null;
  function renderPresetQuickList(scope) {
    const list = scope && scope.querySelector(".fx-e-plist");
    if (!list) return;
    const arr = loadPresets();
    list.innerHTML = (arr.length ? arr.map((p) => `
    <div class="fx-e-pitem" data-id="${p.id}">
      <span class="fx-e-pn" title="${esc(p.name)}">${esc(p.name)}</span>
      <span class="fx-e-pc" title="点击插入：${esc(p.content)}">${esc(p.content)}</span>
      <b class="fx-e-pins" title="并入编辑器（同字段同拼接的卡自动合并去重）">插入</b>
      <b class="fx-e-pdel" title="删除此预设">${ic("close")}</b>
    </div>`).join("") : `<div class="fx-e-pempty">暂无预设：输入名称后「${ic("save")} 存为预设」——保存焦点行（无焦点行时焦点卡 / 整条语句）</div>`) + `<div class="fx-e-pmgr"><b class="fx-e-pmgrob" title="打开管理预设：新建、编辑、分组、排序、搜索、JSON 导入导出">${ic("presetMgr")} 管理预设…</b></div>`;
    const btn = scope.querySelector(".fx-e-pbtn");
    if (btn) btn.innerHTML = ic("expand") + ` 预设 (${arr.length})`;
  }
  function buildEditor(pane) {
    const sfx = "e" + nextEditorSeq();
    pane.innerHTML = editorShellHtml(sfx, false);
    const editor = createEditor(pane);
    editMain = editor;
    renderPresetQuickList(pane);
    const pbox = pane.querySelector(".fx-e-pbox");
    pane.querySelector(".fx-e-pbtn").addEventListener("click", () => {
      pbox.style.display = pbox.style.display === "none" ? "" : "none";
    });
    pane.querySelector(".fx-e-psave").addEventListener("click", () => {
      const f = editor.focusInfo();
      let content, defName = "预设";
      if (f && f.card.raw == null && f.ri >= 0 && f.card.rows[f.ri]) {
        content = cardRowQ(f.card, f.card.rows[f.ri]);
        defName = f.card.field || "关键词";
      } else if (f && f.card.raw == null) {
        content = cardToQuery(f.card);
        defName = f.card.field || "关键词";
      } else content = editor.getQuery();
      if (!content) {
        importToast(`${ic("warn")} 没有可保存的内容`);
        return;
      }
      const nameEl = pane.querySelector(".fx-e-pname");
      const name = (nameEl.value || "").trim() || defName;
      const arr = loadPresets();
      arr.push({ id: Date.now() + Math.floor(Math.random() * 1e6), name, content, ts: (/* @__PURE__ */ new Date()).toLocaleString() });
      if (savePresets(arr)) {
        nameEl.value = "";
        renderPresetQuickList(pane);
        importToast(`${ic("ok")} 已存预设「<b>${esc(name)}</b>」`);
      }
    });
    pane.querySelector(".fx-e-plist").addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest(".fx-e-pmgrob")) {
        openPresetMgr();
        return;
      }
      const item = e.target.closest && e.target.closest(".fx-e-pitem");
      if (!item) return;
      const p = loadPresets().find((x) => String(x.id) === item.dataset.id);
      if (!p) return;
      if (e.target.closest(".fx-e-pdel")) {
        savePresets(loadPresets().filter((x) => String(x.id) !== item.dataset.id));
        renderPresetQuickList(pane);
        return;
      }
      if (e.target.closest(".fx-e-pins") || e.target.closest(".fx-e-pc")) editor.insertPreset(p.content);
    });
    pane.querySelector(".fx-e-qmonth").addEventListener("click", () => editor.toggleQuick("month"));
    pane.querySelector(".fx-e-qcloud").addEventListener("click", () => editor.toggleQuick("cloud"));
    pane.querySelector(".fx-e-reload").addEventListener("click", () => {
      const q = currentQuery();
      if (!q) {
        importToast(`${ic("warn")} 当前页面没有查询语句（先在 FOFA 发起一次搜索）`);
        return;
      }
      if (editor.getQuery() && !window.confirm("编辑器里已有内容，用当前页面语句覆盖？")) return;
      editor.parseFromPage();
      importToast(`${ic("refresh")} 已载入页面语句`);
    });
    pane.querySelector(".fx-e-blank").addEventListener("click", () => {
      if (editor.getQuery() && !window.confirm("编辑器里已有内容，清空并新建空白查询？")) return;
      editor.loadQuery("");
      importToast(`${ic("blank")} 已新建空白查询`);
    });
    pane.querySelector(".fx-e-savefp").addEventListener("click", () => {
      const q = editor.getQuery();
      if (!q) {
        importToast(`${ic("warn")} 当前没有可保存的语句`);
        return;
      }
      const prod = productFromQuery(q);
      const arr = loadLib();
      arr.unshift({ id: Date.now(), name: pickName(prod, []), query: q, ip: "", product: prod, category: "", region: "", server: "", title: "", after: fmtDate(/* @__PURE__ */ new Date()), vendor: "", model: "", note: "", folder: "", ts: (/* @__PURE__ */ new Date()).toLocaleString() });
      saveLib(arr);
      const libPane = document.querySelector("#fofa-toolbox-box .fx-t-pane-lib");
      if (libPane) renderLib(libPane);
      importToast(`${ic("ok")} 已存入指纹库（可切到「指纹库」标签页补充信息）`);
    });
    pane.querySelector(".fx-e-search").addEventListener("click", () => {
      const q = editor.getQuery();
      if (q) openTab(q);
    });
    pane.querySelector(".fx-e-copy").addEventListener("click", (ev) => {
      const q = editor.getQuery();
      if (q) copyText(q, ev.currentTarget);
    });
    pane.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.altKey && !e.ctrlKey && !e.shiftKey && !e.isComposing) {
        const q = editor.getQuery();
        if (q) {
          e.preventDefault();
          openTab(q);
        }
      }
    });
  }
  console.info(`[FOFA工具箱] v${VER} 已加载（${location.host}）— 若右键无反应，请先确认控制台显示的是本版本号`);
  injectStyle();
  initIcons();
  initTheme();
  initStyleGuard();
  initStage();
  initToolboxDrag();
  purgeEmptyLib();
  initToolboxBtn();
  initComplete();
  initRubber();
  document.addEventListener("contextmenu", (e) => {
    if (menu && menu.contains(e.target)) {
      e.preventDefault();
      return;
    }
    hideMenu();
    const cand = findCandidate(e);
    if (!cand) return;
    e.preventDefault();
    showMenu(e.clientX, e.clientY, cand);
  }, true);
  document.addEventListener("mousedown", (e) => {
    if (menu && !menu.contains(e.target)) hideMenu();
    const p = document.getElementById("fofa-toolbox-stage-panel");
    if (p && !p.contains(e.target) && !(e.target.closest && e.target.closest("#fofa-toolbox-stage-bar"))) hideStagePanel();
    const lib = document.getElementById("fofa-toolbox-box");
    if (lib && !lib.contains(e.target) && !(e.target.closest && e.target.closest("#fofa-toolbox-btn,#fofa-imp-toast,#fofa-kb-lightbox,#fofa-preset-mgr,#fofa-export-choice"))) closeToolbox(true);
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const lb = document.getElementById("fofa-kb-lightbox");
      if (lb) {
        lb.remove();
        return;
      }
      const mgr = document.getElementById("fofa-preset-mgr");
      if (mgr) {
        mgr.remove();
        return;
      }
      hideMenu();
      hideStagePanel();
      rubberStop(true);
      closeToolbox(true);
    }
  }, true);
  document.addEventListener("keydown", (e) => {
    if (!e.altKey || e.ctrlKey || e.shiftKey || e.isComposing) return;
    if (e.code === "KeyQ") {
      e.preventDefault();
      if (document.getElementById("fofa-toolbox-box")) closeToolbox(true);
      else openToolbox();
      return;
    }
    const pane = document.querySelector("#fofa-toolbox-box .fx-t-pane-edit");
    if (pane && pane.classList.contains("on") && editMain) {
      if (e.code === "KeyA") {
        e.preventDefault();
        editMain.addItem("card");
      } else if (e.code === "KeyO") {
        e.preventDefault();
        editMain.addItem("row");
      }
    }
  }, true);
  window.addEventListener("scroll", hideMenu, true);
  window.addEventListener("resize", hideMenu);

})();