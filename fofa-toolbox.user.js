// ==UserScript==
// @name         FOFA 工具箱
// @namespace    fofa.toolbox
// @version      4.4.1
// @description  FOFA 工具箱：右键任意元素（组件/favicon/国旗/世界地图/相关Icon/各排名条目…）排除或包含该条件并在新标签打开；Alt+拖拽框选批量排除；Alt+Q 工具箱=指纹收藏库（表格编辑、JSON/CSV 导出导入）+ 查询编辑器（结构化拆分当前语句、Alt+A/O 快捷且/或、一键一月内/排除云服务并搜索）+ 知识库（厂商贴牌关系、Server/Title、可粘贴产品截图）。Shift+右键 = 原生菜单
// @match        *://fofa.info/*
// @match        *://*.fofa.info/*
// @match        *://fofa.so/*
// @match        *://*.fofa.so/*
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const OPEN_IN_BACKGROUND = false; // 新标签页是否在后台打开（后台打开会丢失 opener 树状关系）
  const MAX_TEXT_LEN = 60;          // 兜底取词的最大文本长度
  const VER = '4.4.1';

  console.info(`[FOFA工具箱] v${VER} 已加载（${location.host}）— 若右键无反应，请先确认控制台显示的是本版本号`);

  let menu = null;

  /* ---------------- base64 与 URL 工具 ---------------- */

  const b64enc = (s) => btoa(String.fromCharCode.apply(null, new TextEncoder().encode(s)));
  const b64dec = (s) => {
    s = String(s).trim().replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return new TextDecoder('utf-8').decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
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

  /* ---------------- 语句处理 ---------------- */

  // FOFA 链接里既有单等号（模糊匹配 country="US"）也有双等号（精确匹配 server=="nginx"），
  // 字段名可含点（cert.subject.org）；两种都取反为 !=
  function negate(cond) {
    const m = /^\s*([A-Za-z_][\w.]*)\s*={1,2}(?!=)\s*([\s\S]+?)\s*$/.exec(cond);
    return m ? `${m[1]}!=${m[2]}` : null;
  }
  const ensureNeg = (c) => negate(c) || c.replace(/^(\s*[A-Za-z_][\w.]*\s*)={1,2}(?!=)/, '$1!=');
  const ensurePos = (c) => c.replace(/^(\s*[A-Za-z_][\w.]*\s*)!=/, '$1=');

  // 顶层按 && 切分（跳过引号与括号内的 &&）
  function splitTop(q) {
    const parts = [];
    let depth = 0, inStr = false, buf = '';
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      if (inStr) { buf += c; if (c === '"') inStr = false; continue; }
      if (c === '"') { inStr = true; buf += c; continue; }
      if (c === '(') { depth++; buf += c; continue; }
      if (c === ')') { depth = depth > 0 ? depth - 1 : 0; buf += c; continue; } // 多余的右括号按深度 0 处理，避免深度转负后顶层 && 全部失灵
      if (depth === 0 && c === '&' && q[i + 1] === '&') { parts.push(buf.trim()); buf = ''; i++; continue; }
      buf += c;
    }
    parts.push(buf.trim());
    return parts.filter(Boolean);
  }

  // 从链接语句中取出“新增的条件”。FOFA 组链接有三种形态：
  //   1) cur && 新条件（前缀拼接）
  //   2) (新条件 && 部分cur) && 其余cur（括号重组，常见于分类/时间过滤）
  //   3) 仅重排（段集合相同 -> 无新增，如分页链接）
  function extractNew(linkQuery, current) {
    const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
    const lq = norm(linkQuery);
    const cur = norm(current || '');
    if (!cur) return lq;
    if (lq === cur) return null;
    if (lq.startsWith(cur + ' && ')) return lq.slice(cur.length + 4).trim() || null;
    const flat = (s) => String(s).replace(/\s+/g, ''); // 空格风格差异（&& 两边有无空格）不影响“已存在”判断
    const curFlat = flat(cur);
    const has = (s) => curFlat.includes(flat(s));
    const walk = (q) => {
      const extra = [];
      for (const s of splitTop(q)) {
        if (has(s)) continue;
        const inner = s.startsWith('(') && s.endsWith(')') ? s.slice(1, -1) : null;
        if (inner !== null && has(inner)) continue; // 只是加了层括号
        if (inner !== null) { const r = walk(inner); if (r) return r; }   // 组内找新增
        extra.push(s);
      }
      return extra.length === 1 ? extra[0] : null;
    };
    return walk(lq);
  }

  // 语句是否已包含某条件（忽略空白差异），自引用判定用
  function condInQuery(q, cond) {
    const flat = (s) => String(s).replace(/\s+/g, '');
    return flat(q || '').includes(flat(cond));
  }

  // 把语句拍平成叶子条件数组（递归剥括号）
  function flattenLeaves(q) {
    const out = [];
    const rec = (s) => {
      for (const part of splitTop(String(s).replace(/\s+/g, ' ').trim())) {
        const p = part.trim();
        if (p.startsWith('(') && p.endsWith(')')) rec(p.slice(1, -1));
        else out.push(p);
      }
    };
    rec(q);
    return out;
  }

  // 自引用链接（当前语句已含该条件，如分类排名里当前选中的第一条）：
  // 链接与当前语句相同（无新增条件）。按链接文本在语句里找到对应条件，
  // “排除”语义应为就地取反（替换掉语句里的该条件），追加会自相矛盾
  function selfCondition(lq, linkText) {
    const txt = String(linkText || '').trim();
    if (!txt) return null;
    for (const leaf of flattenLeaves(lq)) {
      const m = /^\s*([A-Za-z_][\w.]*)\s*={1,2}(?!=)\s*"([^"]*)"\s*$/.exec(leaf);
      if (m && m[2] === txt) return leaf;
    }
    return null;
  }

  /* ---------------- 国名/协议名映射（划选文本与国旗兜底用） ---------------- */

  const COUNTRY_ZH = {
    '中国':'CN','美国':'US','日本':'JP','韩国':'KR','朝鲜':'KP','香港':'HK','澳门':'MO','台湾':'TW','新加坡':'SG',
    '德国':'DE','法国':'FR','英国':'GB','俄罗斯':'RU','加拿大':'CA','澳大利亚':'AU','印度':'IN','巴西':'BR',
    '荷兰':'NL','意大利':'IT','西班牙':'ES','越南':'VN','泰国':'TH','印度尼西亚':'ID','马来西亚':'MY','菲律宾':'PH',
    '土耳其':'TR','伊朗':'IR','以色列':'IL','乌克兰':'UA','波兰':'PL','瑞士':'CH','瑞典':'SE','挪威':'NO','丹麦':'DK',
    '芬兰':'FI','比利时':'BE','奥地利':'AT','爱尔兰':'IE','新西兰':'NZ','墨西哥':'MX','阿根廷':'AR','南非':'ZA',
    '埃及':'EG','阿联酋':'AE','沙特阿拉伯':'SA','巴基斯坦':'PK','孟加拉国':'BD','缅甸':'MM','柬埔寨':'KH','老挝':'LA',
    '蒙古':'MN','捷克':'CZ','希腊':'GR','葡萄牙':'PT','匈牙利':'HU','罗马尼亚':'RO','保加利亚':'BG','白俄罗斯':'BY',
    '卢森堡':'LU','智利':'CL','哥伦比亚':'CO','秘鲁':'PE','委内瑞拉':'VE','尼日利亚':'NG','肯尼亚':'KE','印尼':'ID'
  };
  const COUNTRY_EN = {
    china:'CN','united states':'US','united kingdom':'GB','russia':'RU','japan':'JP','korea':'KR','south korea':'KR',
    germany:'DE',france:'FR', australia:'AU', india:'IN', brazil:'BR', netherlands:'NL',
    italy:'IT', spain:'ES', vietnam:'VN', thailand:'TH', singapore:'SG', indonesia:'ID', malaysia:'MY', philippines:'PH',
    turkey:'TR', iran:'IR', israel:'IL', ukraine:'UA', poland:'PL', switzerland:'CH', sweden:'SE', norway:'NO',
    denmark:'DK', finland:'FI', belgium:'BE', austria:'AT', ireland:'IE', 'new zealand':'NZ', mexico:'MX',
    argentina:'AR', 'south africa':'ZA', egypt:'EG', 'united arab emirates':'AE', 'saudi arabia':'SA', pakistan:'PK',
    bangladesh:'BD', myanmar:'MM', cambodia:'KH', laos:'LA', mongolia:'MN', czechia:'CZ', czech:'CZ', greece:'GR',
    portugal:'PT', hungary:'HU', romania:'RO', bulgaria:'BG', belarus:'BY', luxembourg:'LU', chile:'CL',
    colombia:'CO', peru:'PE', venezuela:'VE', nigeria:'NG', kenya:'KE', taiwan:'TW', 'hong kong':'HK', macao:'MO'
  };
  const NAME2CODE = Object.assign({}, COUNTRY_EN, COUNTRY_ZH);

  const PROTO_SET = new Set(['http','https','ssh','ftp','sftp','telnet','smtp','pop3','imap','rdp','vnc','snmp','mysql','redis','mongodb','memcached','elasticsearch','rabbitmq','kafka','zookeeper','nfs','smb','ldap','ldaps','dns','socks5','socks4','rtsp','onvif','bacnet','modbus','mqtt','amqp','svn','ipp','mms']);

  /* ---------------- 页面取值 ---------------- */

  const currentQuery = () => queryFromUrl(location.href);

  function firstText(el) {
    if (!el) return '';
    const attr = el.getAttribute && (el.getAttribute('title') || el.getAttribute('alt'));
    const raw = attr || el.innerText || el.textContent || '';
    return raw.split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';
  }

  // 国旗图片（img.hsxa-country-img，alt 固定为 "country"，本身无国家信息）：
  // 就近向上找所在行/所在统计项里的国家搜索链接。
  // 结果行里的链接是独立的 country="DE"；侧栏统计里的是组合语句（当前语句 && country="US"），需先剥前缀
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
      for (const a of box.querySelectorAll('a')) {
        const code = NAME2CODE[(a.textContent || '').trim().toLowerCase()];
        if (code) return `country="${code}"`;
      }
    }
    return null;
  }

  // 服务器图标（span.hsxa-server-icon，外层 <a> 无 href，值在锚文本里，如 "nginx"）
  function serverFromIcon(t) {
    const icon = t.closest ? t.closest('span.hsxa-server-icon, span[class*="server-icon"]') : null;
    if (!icon) return null;
    const a = icon.closest('a') || icon.parentElement;
    const txt = firstText(a).slice(0, MAX_TEXT_LEN);
    return txt ? `server="${txt}"` : null;
  }

  /* ---------- 侧栏“相关Icon”（Vue 数据提取，无副作用） ----------
     图标没有链接，点击由路由跳到 (当前语句 && icon_hash=="hash")；
     图标数据在 Vue 组件 props 里：keyWord="icon_hash", items[]{key=hash, imageBase64}。
     Vue3 生产构建不在元素上暴露句柄，只能从挂载容器的 __vue_app__._container._vnode
     沿组件树下钻（Nuxt 根下是 Suspense，内容在 suspense.activeBranch）。
     Tampermonkey 沙箱读不到页面 expando，须先经 unsafeWindow 取页面世界的元素。 */

  function vueWalkMatch(match) {
    try {
      const w = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;
      const doc = w.document;
      const wrap = doc && doc.querySelector && doc.querySelector('.similar-icons-wrapper');
      if (!wrap) return null;
      let container = null;
      for (let n = wrap; n; n = n.parentElement) {
        if (n.__vue_app__) { container = n.__vue_app__._container || n; break; }
      }
      const root = container && container._vnode;
      if (!root) return null;
      let visited = 0;
      const walk = (vnode, depth) => {
        if (!vnode || typeof vnode !== 'object' || depth > 100 || visited > 6000) return undefined;
        const inst = vnode.component;
        if (inst) {
          visited++;
          let se = inst.subTree && inst.subTree.el;
          if (se && (se.nodeType === 3 || se.nodeType === 8)) se = se.parentElement;
          if (se && se.querySelectorAll && se.contains(wrap)) {
            const r = match(inst, se);
            if (r !== null && r !== undefined) return r;
          }
          return walk(inst.subTree, depth + 1);
        }
        if (vnode.suspense && vnode.suspense.activeBranch) return walk(vnode.suspense.activeBranch, depth + 1);
        if (Array.isArray(vnode.children)) {
          for (const c of vnode.children) {
            if (c && typeof c === 'object') {
              const r = walk(c, depth + 1);
              if (r !== null && r !== undefined) return r;
            }
          }
        }
        return undefined;
      };
      return walk(root, 0);
    } catch (e) {
      return null;
    }
  }

  function iconFromSidebar(t) {
    const img = t.closest ? t.closest('.icon-item-wrapper img, .icon_hash-icon-list img, .similar-icons-wrapper img') : null;
    if (!img) return null;
    const m = /base64,([A-Za-z0-9+/=]+)/.exec(img.src || '');
    if (!m) return null;
    const b64 = m[1];
    const hit = vueWalkMatch((inst, se) => {
      if (!se.querySelector('.icon_hash-icon-list')) return null;
      const p = inst.props || {};
      if (p.keyWord !== 'icon_hash' || !Array.isArray(p.items)) return null;
      for (const it of p.items) {
        if (it && typeof it === 'object' && it.key !== undefined && typeof it.imageBase64 === 'string'
          && it.imageBase64.length >= 64 && it.imageBase64.slice(0, 64) === b64.slice(0, 64)) {
          return String(it.key);
        }
      }
      return null;
    });
    return hit ? `icon_hash="${hit}"` : null;
  }

  // 侧栏世界地图（ECharts 画的 canvas，国家不是 DOM 元素，拿不到图表实例）：
  // 右键时鼠标必然悬停在某个国家上，此刻地图自带的可见 tooltip 里就是国家名（如“加拿大 : 9233”或"NO : 0"）
  function countryFromMap(t) {
    const canvas = t.closest ? t.closest('.hsxa-result-map canvas, .echarts canvas') : null;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const tips = [...document.querySelectorAll('div')].filter((d) => {
      if (!d.offsetWidth || d.offsetHeight > 120) return false;
      const s = getComputedStyle(d);
      if (s.position !== 'absolute' || s.visibility === 'hidden' || parseFloat(s.opacity || '1') === 0) return false;
      const r = d.getBoundingClientRect();
      if (!(r.x < rect.right + 100 && r.right > rect.left - 100 && r.y < rect.bottom + 150 && r.bottom > rect.top - 150)) return false;
      const txt = (d.textContent || '').trim();
      return txt.length > 0 && txt.length <= 100;
    });
    for (const d of tips) {
      const first = ((d.innerText || d.textContent || '').split('\n').map((x) => x.trim()).filter(Boolean)[0]) || '';
      const name = first.split(/[:：]/)[0].replace(/[0-9,，.\s]+$/, '').trim();
      if (!name) continue;
      if (/^[A-Za-z]{2}$/.test(name)) return `country="${name.toUpperCase()}"`;
      const code = NAME2CODE[name.toLowerCase()];
      if (code) return `country="${code}"`;
    }
    return null;
  }

  /* ---------------- 右键目标识别（基于 FOFA v5.5 实测 DOM） ----------------
     结果页各字段（产品/IP/端口/城市/ASN/org/domain/header_hash/favicon 的 icon_hash/国家名…）
     都是 <a href="/result?qbase64=当前语句&&字段=值">，直接解码即得精确条件。
     favicon 图标本体就在 icon_hash 链接内部；国旗图片本身无信息，需就近找 country 链接。 */

  function findCandidate(e) {
    const t = e.target;
    if (!(t instanceof Element)) return null;
    if (menu && menu.contains(t)) return null;
    if (e.shiftKey) return null; // Shift+右键 = 强制原生菜单

    const cur = currentQuery();

    // 1) 带有 qbase64 的搜索链接（组件/产品/favicon(icon_hash)/国家名/IP/端口/地区/侧栏各排名…）
    const link = t.closest('a[href*="qbase64="]');
    if (link) {
      const lq = queryFromUrl(link.href);
      if (lq) {
        const cond = extractNew(lq, cur);
        // 取反失败（复杂条件/或组合）时原样显示真实条件供编辑，绝不猜测字段
        if (cond) return { cur, cond: negate(cond) || cond, include: cond };
        // 自引用链接（无新增条件，如分类排名里当前选中的第一条）→ 就地取反。
        // 仅当 self 确实已存在于当前语句才算自引用；否则它是右键到的新条件
        //（链接语句与页面语句格式有差异、extractNew 提取失败时会走到这里），
        // 按普通新条件追加，绝不能给 replace——replace 落空等于什么都不做
        if (cur) {
          const self = selfCondition(lq, firstText(link));
          if (self) {
            const replace = condInQuery(cur, self) ? self : null;
            return { cur, cond: negate(self) || self, include: self, replace };
          }
        }
      }
    }

    // 2) 国旗图片
    const country = countryFromFlag(t);
    if (country) return { cur, cond: negate(country) || country, include: country };

    // 3) 侧栏世界地图（依赖当前悬停的 tooltip）
    const mapCountry = countryFromMap(t);
    if (mapCountry) return { cur, cond: negate(mapCountry) || mapCountry, include: mapCountry };

    // 4) 服务器图标
    const server = serverFromIcon(t);
    if (server) return { cur, cond: negate(server) || server, include: server };

    // 5) 侧栏“相关Icon”图标（Vue 数据提取 icon_hash）
    const sidebarIcon = iconFromSidebar(t);
    if (sidebarIcon) return { cur, cond: negate(sidebarIcon) || sidebarIcon, include: sidebarIcon };

    // 6) 划选文本（国名/协议名/产品名）
    const st = (window.getSelection ? String(window.getSelection()) : '').trim();
    if (st && st.length <= 120) {
      const low = st.toLowerCase();
      const code = NAME2CODE[low];
      if (code) return { cur, cond: `country!="${code}"`, include: `country="${code}"` };
      if (PROTO_SET.has(low)) return { cur, cond: `protocol!="${low}"`, include: `protocol="${low}"` };
      return { cur, cond: `product!="${st}"`, include: `product="${st}"` };
    }

    // 其余一律不劫持，保持浏览器原生右键菜单
    return null;
  }

  /* ---------------- 打开 / 复制 / 批量暂存 ---------------- */

  const STAGE_KEY = 'fofa-toolbox-staged';
  const CURWIN_KEY = 'fofa-toolbox-current';

  function loadStaged() {
    try { const a = JSON.parse(sessionStorage.getItem(STAGE_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function saveStaged(arr) {
    try { sessionStorage.setItem(STAGE_KEY, JSON.stringify(arr)); } catch (e) { /* ignore */ }
  }
  function openInCurrent() {
    try { return sessionStorage.getItem(CURWIN_KEY) === '1'; } catch (e) { return false; }
  }

  // 批量应用：当前语句里已存在的条件就地取反（排除模式），其余追加；包含模式跳过已存在
  // 包含模式的批量拼接（纯函数）：conds 里同字段的多个值用 || 并列并加括号——
  // 一个字段不可能同时等于多个值，用 && 连接会使语句恒空；不同字段 / 识别不了的条件
  // 仍用 && 连接；同值去重（模糊/精确算同值）；全文已存在于 cur 的条件跳过；
  // 输出保持首见顺序（同字段的值聚到该字段首次出现的位置）
  function joinIncludeBatch(cur, conds) {
    const q = String(cur || '');
    const groups = new Map();
    const seq = []; // {g:字段组键} 在首见位置占位，或 {s:独立条件}
    for (const c of conds) {
      const clean = String(c).replace(/\s+/g, ' ').trim();
      if (!clean || q.includes(clean)) continue;
      const m = /^([A-Za-z_][\w.]*)\s*={1,2}(?!=)\s*([\s\S]+)$/.exec(clean);
      if (!m) { seq.push({ s: clean }); continue; }
      const gk = m[1].toLowerCase();
      if (!groups.has(gk)) { groups.set(gk, []); seq.push({ g: gk }); }
      const vk = m[2].replace(/\s+/g, ' ').trim();
      if (groups.get(gk).some((x) => x.vk === vk)) continue;
      groups.get(gk).push({ vk, clean });
    }
    const pieces = [];
    for (const it of seq) {
      if (it.s) { pieces.push(it.s); continue; }
      const g = groups.get(it.g);
      pieces.push(g.length > 1 ? '(' + g.map((x) => x.clean).join(' || ') + ')' : g[0].clean);
    }
    return pieces.join(' && ');
  }

  // 批量应用：排除时当前语句里已存在的条件就地取反（!= 之间用 && 是正确语义）；
  // 包含时同字段多值走 joinIncludeBatch（|| 并列加括号），不同字段仍用 &&
  function applyBatch(cur, conds, mode) {
    const q0 = (cur || '').trim();
    if (mode !== 'include') {
      let q = q0;
      for (const c of conds) {
        const clean = String(c).replace(/\s+/g, ' ').trim();
        if (!clean) continue;
        if (q.includes(clean)) { q = q.replace(clean, negate(clean) || clean); continue; }
        const piece = negate(clean) || clean;
        q = q ? q + ' && ' + piece : piece;
      }
      return q;
    }
    const joined = joinIncludeBatch(q0, conds);
    return joined ? (q0 ? q0 + ' && ' + joined : joined) : q0;
  }

  // 把一批（正条件形式的）暂存条件并入主查询编辑器：exclude 逐条取反成 && 排除链；
  // include 走 joinIncludeBatch——同字段多值用 || 并列加括号（在编辑器里成或卡）。
  // 复用预设并入通道——解析成卡后与编辑器现有卡自动合并去重（同字段集中一卡）
  function editorAppend(conds, mode) {
    const clean = (c) => String(c).replace(/\s+/g, ' ').trim();
    const joined = mode === 'exclude'
      ? conds.map(clean).filter(Boolean).map(ensureNeg).filter(Boolean).join(' && ')
      : joinIncludeBatch('', conds);
    if (!joined) return;
    if (!document.getElementById('fofa-toolbox-box')) openToolbox(false, 'edit');
    if (!editMain) return;
    editMain.insertPreset(joined);
    importToast(mode === 'exclude'
      ? '✅ 已作为排除卡并入查询编辑器（可在编辑器里继续调整）'
      : '✅ 已并入查询编辑器（同字段多值已并列成或卡，可继续调整）');
  }

  function openTab(query) {
    const url = `${location.origin}/result?qbase64=${encodeURIComponent(b64enc(query))}`;
    if (openInCurrent()) { location.assign(url); return; }
    // 默认经 window.open 打开：新标签携带 opener 关系，
    // Tree Style Tab 等树状标签插件会把它挂为当前标签的子标签。
    // （GM_openInTab 创建的标签没有 opener，会丢失树状归属）
    if (OPEN_IN_BACKGROUND && typeof GM_openInTab === 'function') {
      GM_openInTab(url, { active: false });
      return;
    }
    const w = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;
    try {
      if (w.open(url, '_blank')) return;
    } catch (e) { /* 弹窗被拦截时走 GM_openInTab */ }
    if (typeof GM_openInTab === 'function') GM_openInTab(url, { active: true });
    else window.open(url, '_blank');
  }

  function fallbackCopy(s, done) {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
    ta.remove();
  }

  function copyText(s, btn) {
    const done = () => {
      const old = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = old; }, 1200);
    };
    if (typeof GM_setClipboard === 'function') { GM_setClipboard(s); done(); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).then(done).catch(() => fallbackCopy(s, done));
    } else {
      fallbackCopy(s, done);
    }
  }

  /* ---------------- 右键菜单 ---------------- */

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let toolboxStyle = null; // 样式节点被页面框架摘掉后可复用重挂
  function injectStyle() {
    if (toolboxStyle && toolboxStyle.isConnected) return;
    if (!toolboxStyle) {
      toolboxStyle = document.createElement('style');
      toolboxStyle.id = 'fofa-toolbox-style';
      toolboxStyle.textContent = `
#fofa-toolbox-menu{position:fixed;z-index:2147483647;width:368px;box-sizing:border-box;background:#fff;color:#24292f;
  border:1px solid #d0d7de;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.14);padding:8px;
  font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
#fofa-toolbox-menu .fx-cond{width:100%;box-sizing:border-box;background:#fff;border:1px solid #d0d7de;border-radius:6px;
  color:#24292f;padding:5px 8px;font:12px/1.4 Consolas,Menlo,monospace;outline:none}
#fofa-toolbox-menu .fx-cond:focus{border-color:#f1961f}
#fofa-toolbox-menu .fx-btns{display:flex;gap:6px;margin-top:8px}
#fofa-toolbox-menu .fx-btns button{border:1px solid #d0d7de;border-radius:6px;padding:5px 10px;cursor:pointer;
  font:12px/1.4 inherit;background:#f6f8fa;color:#24292f;white-space:nowrap}
#fofa-toolbox-menu .fx-btns button:hover{background:#eef1f4}
#fofa-toolbox-menu .fx-primary{flex:1;background:#f1961f;border-color:#f1961f;color:#fff;font-weight:600}
#fofa-toolbox-menu .fx-primary:hover{background:#ffab2e;border-color:#ffab2e}
#fofa-toolbox-menu .fx-inc,#fofa-toolbox-menu .fx-or,#fofa-toolbox-menu .fx-eedit-ex,#fofa-toolbox-menu .fx-eedit-in{flex:1}
#fofa-toolbox-menu .fx-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;color:#8b949e;font-size:10px;margin-top:6px}
#fofa-toolbox-menu .fx-curwin{display:flex;align-items:center;gap:3px;cursor:pointer;user-select:none}
#fofa-toolbox-menu .fx-curwin input{margin:0;accent-color:#f1961f}
#fofa-toolbox-stage-bar{position:fixed;right:12px;bottom:12px;z-index:2147483646;background:#f1961f;color:#fff;border-radius:16px;
  padding:4px 12px;font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer;
  box-shadow:0 4px 14px rgba(0,0,0,.28);user-select:none}
#fofa-toolbox-stage-bar:hover{background:#ffab2e}
#fofa-toolbox-stage-panel{position:fixed;right:12px;bottom:48px;z-index:2147483647;width:380px;box-sizing:border-box;
  background:#fff;color:#24292f;border:1px solid #d0d7de;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.14);padding:8px;
  font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
#fofa-toolbox-stage-panel .fx-p-title{font-weight:600;color:#57606a;margin-bottom:6px}
#fofa-toolbox-stage-panel .fx-p-list{max-height:200px;overflow:auto}
#fofa-toolbox-stage-panel .fx-p-item{display:flex;align-items:center;gap:6px;padding:3px 4px;border-radius:4px}
#fofa-toolbox-stage-panel .fx-p-item:hover{background:#f6f8fa}
#fofa-toolbox-stage-panel .fx-p-item span{flex:1;font-family:Consolas,Menlo,monospace;font-size:11px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
#fofa-toolbox-stage-panel .fx-p-item b{cursor:pointer;color:#8b949e;font-weight:400;padding:0 4px}
#fofa-toolbox-stage-panel .fx-p-item b:hover{color:#e5484d}
#fofa-toolbox-stage-panel .fx-p-btns{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
#fofa-toolbox-stage-panel .fx-p-btns button{border:1px solid #d0d7de;border-radius:6px;padding:5px 8px;cursor:pointer;
  font:12px/1.4 inherit;background:#f6f8fa;color:#24292f;white-space:nowrap}
#fofa-toolbox-stage-panel .fx-p-btns button:hover{background:#eef1f4}
#fofa-toolbox-stage-panel .fx-p-primary{flex:1;background:#f1961f;border-color:#f1961f;color:#fff;font-weight:600}
#fofa-toolbox-stage-panel .fx-p-primary:hover{background:#ffab2e;border-color:#ffab2e}
#fofa-toolbox-rubber{position:fixed;z-index:2147483646;border:1.5px dashed #f1961f;background:rgba(241,150,31,.12);
  pointer-events:none}
#fofa-toolbox-btn{position:fixed;left:12px;bottom:12px;z-index:2147483646;background:#fff;color:#57606a;
  border:1px solid #d0d7de;border-radius:16px;padding:4px 12px;cursor:pointer;user-select:none;
  font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.2)}
#fofa-toolbox-btn:hover{color:#f1961f;border-color:#f1961f}
#fofa-toolbox-box{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;width:1080px;
  height:520px;max-width:94vw;max-height:84vh;display:flex;flex-direction:column;background:#fff;color:#24292f;border:1px solid #d0d7de;
  border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden;
  font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
#fofa-toolbox-box.fx-l-lower{top:62%}
#fofa-toolbox-box .fx-l-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #eef1f4;cursor:move;user-select:none}
#fofa-toolbox-box .fx-l-title{font-weight:600}
#fofa-toolbox-box .fx-l-hbtns{display:flex;gap:6px}
#fofa-toolbox-box .fx-l-hbtns button{border:1px solid #d0d7de;background:#f6f8fa;border-radius:6px;padding:4px 10px;
  cursor:pointer;font:12px/1.4 inherit;color:#24292f}
#fofa-toolbox-box .fx-l-hbtns button:hover{background:#eef1f4}
#fofa-toolbox-box .fx-l-tablewrap{overflow:auto;flex:1}
#fofa-toolbox-box .fx-l-table{border-collapse:collapse;width:100%}
#fofa-toolbox-box .fx-l-table th{position:sticky;top:0;background:#f6f8fa;color:#57606a;font-weight:600;text-align:left;
  padding:6px 8px;border-bottom:1px solid #eef1f4;white-space:nowrap}
#fofa-toolbox-box .fx-l-table td{padding:5px 8px;border-bottom:1px solid #f0f2f5;vertical-align:top;word-break:break-all}
#fofa-toolbox-box .fx-l-table td[contenteditable]:focus{outline:1.5px solid #f1961f;outline-offset:-1.5px;background:#fffdf5}
#fofa-toolbox-box .fx-l-mono{font-family:Consolas,Menlo,monospace;font-size:11px}
#fofa-toolbox-box .fx-l-ops b{cursor:pointer;color:#8b949e;font-weight:400;margin-right:6px}
#fofa-toolbox-box .fx-l-ops b.fx-l-search:hover{color:#f1961f}
#fofa-toolbox-box .fx-l-ops b.fx-l-dedup:hover{color:#f1961f}
#fofa-toolbox-box .fx-l-ops b.fx-l-undorow{color:#f1961f}
#fofa-toolbox-box .fx-l-ops b.fx-l-undorow:hover{color:#b25e09}
#fofa-toolbox-box td.fx-rowdrag{cursor:grab;color:#c4cdd5;text-align:center;user-select:none;font-size:13px}
#fofa-toolbox-box td.fx-rowdrag:active{cursor:grabbing;color:#f1961f}
#fofa-toolbox-box tr.fx-dragging td{opacity:.45}
#fofa-toolbox-box tr.fx-drop-above td{border-top:2px solid #f1961f}
#fofa-toolbox-box tr.fx-drop-below td{border-bottom:2px solid #f1961f}
#fofa-toolbox-box .fx-l-ops b.fx-l-cal:hover{color:#f1961f}
#fofa-toolbox-box .fx-l-ops b.fx-l-del:hover{color:#e5484d}
#fofa-toolbox-box .fx-l-ops b.fx-l-pinbtn:hover{color:#b25e09}
#fofa-toolbox-box .fx-l-ops b.fx-l-pinbtn.on{color:#b25e09}
#fofa-toolbox-box tr.fx-l-userpin td{background:#fffdf5}
#fofa-export-choice{position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);z-index:2147483647;width:340px;
  background:#fff;color:#24292f;border:1px solid #d0d7de;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.25);
  padding:14px;font:12px/1.6 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
#fofa-export-choice .fx-e-title{font-weight:600;margin-bottom:6px}
#fofa-export-choice .fx-e-text{color:#57606a;margin-bottom:10px}
#fofa-export-choice .fx-e-btns{display:flex;gap:6px;flex-wrap:wrap}
#fofa-export-choice .fx-e-btns button{flex:1;border:1px solid #d0d7de;background:#f6f8fa;border-radius:6px;
  padding:6px 8px;cursor:pointer;font:12px/1.4 inherit;color:#24292f;white-space:nowrap}
#fofa-export-choice .fx-e-btns button:hover{background:#eef1f4}
#fofa-export-choice .fx-e-resolve{background:#f1961f;border-color:#f1961f;color:#fff;font-weight:600}
#fofa-export-choice .fx-e-resolve:hover{background:#ffab2e;border-color:#ffab2e}
#fofa-imp-toast{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:2147483647;max-width:480px;
  background:#fff;color:#24292f;border:1px solid #d0d7de;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.22);
  padding:10px 14px;font:12px/1.6 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer}
#fofa-imp-toast b{color:#b25e09}
#fofa-toolbox-box .fx-l-empty{color:#8b949e;text-align:center;padding:24px}
#fofa-toolbox-box .fx-l-foot{padding:6px 12px;color:#8b949e;font-size:11px;border-top:1px solid #eef1f4}
#fofa-toolbox-box .fx-t-tabs{display:flex;gap:4px;margin-left:12px;flex:1}
#fofa-toolbox-box .fx-t-tab{border:1px solid #d0d7de;background:#f6f8fa;border-radius:6px;padding:3px 10px;
  cursor:pointer;font:12px/1.4 inherit;color:#57606a;white-space:nowrap}
#fofa-toolbox-box .fx-t-tab:hover{background:#eef1f4}
#fofa-toolbox-box .fx-t-tab.on{background:#f1961f;border-color:#f1961f;color:#fff;font-weight:600}
#fofa-toolbox-box .fx-t-body{flex:1;min-height:0;display:flex;flex-direction:column}
#fofa-toolbox-box .fx-t-pane{display:none;flex:1;min-height:0;flex-direction:column}
#fofa-toolbox-box .fx-t-pane.on{display:flex}
#fofa-toolbox-box .fx-l-tools{display:flex;gap:6px;padding:8px 12px 0;flex-wrap:wrap;align-items:center}
#fofa-toolbox-box .fx-l-count{color:#8b949e;font-size:11px;margin-right:2px}
#fofa-toolbox-box .fx-l-tools button{border:1px solid #d0d7de;background:#f6f8fa;border-radius:6px;padding:4px 10px;
  cursor:pointer;font:12px/1.4 inherit;color:#24292f;white-space:nowrap}
#fofa-toolbox-box .fx-l-tools button:hover{background:#eef1f4}
#fofa-toolbox-box .fx-e-quick{display:flex;gap:6px;padding:8px 12px 0;flex-wrap:wrap}
#fofa-toolbox-box .fx-e-quick button,#fofa-toolbox-box .fx-e-adds button,#fofa-toolbox-box .fx-e-actions button{border:1px solid #d0d7de;
  background:#f6f8fa;border-radius:6px;padding:4px 10px;cursor:pointer;font:12px/1.4 inherit;color:#24292f;white-space:nowrap}
#fofa-toolbox-box .fx-e-quick button:hover,#fofa-toolbox-box .fx-e-adds button:hover,#fofa-toolbox-box .fx-e-actions button:hover{background:#eef1f4}
#fofa-toolbox-box .fx-e-quick button.on{background:#f1961f;border-color:#f1961f;color:#fff;font-weight:600}
#fofa-toolbox-box .fx-e-cards{flex:1;min-height:0;overflow:auto;padding:8px 12px;display:flex;flex-direction:column;gap:6px}
#fofa-toolbox-box .fx-e-empty{color:#8b949e;text-align:center;padding:24px}
#fofa-toolbox-box .fx-e-group{border:1px solid #eef1f4;border-radius:8px;padding:5px 8px}
#fofa-toolbox-box .fx-e-group.or{border-color:rgba(241,150,31,.55)}
#fofa-toolbox-box .fx-e-chead{display:flex;align-items:center;gap:4px;margin-bottom:2px}
#fofa-toolbox-box .fx-e-cfld{width:175px;border:1px solid #d0d7de;border-radius:6px;padding:3px 6px;
  font:12px/1.4 Consolas,Menlo,monospace;background:#fff;color:#24292f}
#fofa-toolbox-box .fx-e-cjoin{border:1px solid #d0d7de;border-radius:6px;padding:2px;font:12px/1.4 inherit;
  background:#fff;color:#24292f}
#fofa-toolbox-box .fx-e-cops{margin-left:auto;display:flex;gap:6px}
#fofa-toolbox-box .fx-e-cops b{cursor:pointer;color:#8b949e;font-weight:400}
#fofa-toolbox-box .fx-e-cops b.fx-e-cadd:hover{color:#f1961f}
#fofa-toolbox-box .fx-e-cops b.fx-e-cdel:hover{color:#e5484d}
#fofa-toolbox-box .fx-e-rowand{color:#8b949e;font-size:11px;padding:0 2px}
#fofa-toolbox-box .fx-e-row{display:flex;align-items:center;gap:4px;margin:2px 0}
#fofa-toolbox-box .fx-e-row input,#fofa-toolbox-box .fx-e-row select{border:1px solid #d0d7de;border-radius:6px;
  padding:3px 6px;font:12px/1.4 Consolas,Menlo,monospace;color:#24292f;background:#fff;box-sizing:content-box}
#fofa-toolbox-box .fx-e-row input.fld{width:118px}
#fofa-toolbox-box .fx-e-row input.val{flex:1;min-width:80px}
#fofa-toolbox-box .fx-e-row input.raw{flex:1;min-width:80px}
#fofa-toolbox-box .fx-e-row select{padding:3px 2px}
#fofa-toolbox-box .fx-e-row b{cursor:pointer;color:#8b949e;font-weight:400;padding:0 3px}
#fofa-toolbox-box .fx-e-row b:hover{color:#e5484d}
#fofa-toolbox-box .fx-e-or{color:#b25e09;font-size:11px;padding:0 2px}
#fofa-toolbox-box .fx-e-tag{color:#8b949e;font-size:10px;white-space:nowrap}
#fofa-toolbox-box .fx-e-adds{display:flex;gap:6px;padding:6px 12px 0}
#fofa-toolbox-box .fx-e-qtext{margin:8px 12px 0;width:calc(100% - 24px);box-sizing:border-box;display:block;
  min-height:52px;max-height:160px;resize:vertical;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;
  color:#57606a;padding:6px 8px;font:11px/1.5 Consolas,Menlo,monospace;word-break:break-all;outline:none}
#fofa-toolbox-box .fx-e-qtext:focus{border-color:#f1961f;background:#fffdf5;color:#24292f}
#fofa-toolbox-box .fx-e-qtext::placeholder{color:#b8c0c8}
#fofa-toolbox-box .fx-e-actions{display:flex;gap:6px;padding:8px 12px}
#fofa-toolbox-box .fx-e-actions .fx-e-search{flex:1;background:#f1961f;border-color:#f1961f;color:#fff;font-weight:600}
#fofa-toolbox-box .fx-e-actions .fx-e-search:hover{background:#ffab2e;border-color:#ffab2e}
#fofa-toolbox-box .fx-e-hint{padding:6px 12px;color:#8b949e;font-size:11px;border-top:1px solid #eef1f4}
#fofa-toolbox-box .fx-e-pbox{margin:6px 12px 0;border:1px solid #eef1f4;border-radius:8px;padding:6px 8px}
#fofa-toolbox-box .fx-e-prow{display:flex;gap:6px;margin-bottom:4px}
#fofa-toolbox-box .fx-e-pname{flex:1;border:1px solid #d0d7de;border-radius:6px;padding:3px 8px;
  font:12px/1.4 inherit;background:#fff;color:#24292f;outline:none}
#fofa-toolbox-box .fx-e-pname:focus{border-color:#f1961f}
#fofa-toolbox-box .fx-e-psave{border:1px solid #d0d7de;background:#f6f8fa;border-radius:6px;padding:3px 10px;
  cursor:pointer;font:12px/1.4 inherit;color:#24292f;white-space:nowrap}
#fofa-toolbox-box .fx-e-psave:hover{background:#eef1f4}
#fofa-toolbox-box .fx-e-plist{max-height:150px;overflow:auto}
#fofa-toolbox-box .fx-e-pitem{display:flex;align-items:center;gap:6px;padding:2px 0}
#fofa-toolbox-box .fx-e-pitem .fx-e-pn{color:#24292f;font-weight:600;max-width:130px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
#fofa-toolbox-box .fx-e-pitem .fx-e-pc{flex:1;color:#57606a;font-family:Consolas,Menlo,monospace;font-size:11px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
#fofa-toolbox-box .fx-e-pitem .fx-e-pc:hover{color:#f1961f}
#fofa-toolbox-box .fx-e-pitem b{cursor:pointer;color:#8b949e;font-weight:400;padding:0 4px}
#fofa-toolbox-box .fx-e-pitem b.fx-e-pins{color:#f1961f}
#fofa-toolbox-box .fx-e-pitem b.fx-e-pdel:hover{color:#e5484d}
#fofa-toolbox-box .fx-e-pempty{color:#8b949e;font-size:11px;padding:4px 0}
#fofa-toolbox-box .fx-t-resize{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;z-index:5;
  background:linear-gradient(135deg,transparent 0 46%,#c4cdd5 46% 54%,transparent 54% 66%,#c4cdd5 66% 74%,transparent 74% 86%,#c4cdd5 86% 94%,transparent 94%)}
#fofa-toolbox-box .fx-t-resize:hover{background:linear-gradient(135deg,transparent 0 46%,#f1961f 46% 54%,transparent 54% 66%,#f1961f 66% 74%,transparent 74% 86%,#f1961f 86% 94%,transparent 94%)}
#fofa-toolbox-box .fx-k-search,#fofa-toolbox-box .fx-l-libsearch{flex:1;min-width:170px;border:1px solid #d0d7de;
  border-radius:6px;padding:4px 8px;font:12px/1.4 inherit;background:#fff;color:#24292f;outline:none}
#fofa-toolbox-box .fx-k-search:focus,#fofa-toolbox-box .fx-l-libsearch:focus{border-color:#f1961f}
#fofa-toolbox-box td.fx-k-imgs{white-space:normal;min-width:150px}
#fofa-toolbox-box td.fx-k-imgs:focus{outline:1.5px solid #f1961f;outline-offset:-1.5px}
#fofa-toolbox-box .fx-k-thumbwrap{position:relative;display:inline-block;margin:1px}
#fofa-toolbox-box .fx-k-thumb{width:46px;height:31px;object-fit:cover;border:1px solid #eef1f4;border-radius:3px;
  cursor:zoom-in;display:block;background:#fff}
#fofa-toolbox-box .fx-k-thumbwrap b{position:absolute;right:-4px;top:-5px;cursor:pointer;color:#fff;background:#e5484d;
  border-radius:50%;width:13px;height:13px;line-height:12px;text-align:center;font-size:9px;font-weight:400;display:none}
#fofa-toolbox-box .fx-k-thumbwrap:hover b{display:block}
#fofa-toolbox-box .fx-k-imgs .fx-k-addimg{color:#8b949e;cursor:pointer;font-weight:400;font-size:11px;padding:0 3px}
#fofa-toolbox-box .fx-k-imgs .fx-k-addimg:hover{color:#f1961f}
#fofa-toolbox-box .fx-k-hint{color:#b8c0c8;font-size:10px}
#fofa-kb-lightbox{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.82);display:flex;
  align-items:center;justify-content:center;cursor:zoom-out}
#fofa-kb-lightbox img{max-width:92vw;max-height:92vh;border-radius:4px;box-shadow:0 6px 40px rgba(0,0,0,.5)}
#fofa-toolbox-box .fx-l-ghead td,#fofa-preset-mgr .fx-l-ghead td{background:#f6f8fa;color:#57606a;font-weight:600;
  padding:4px 8px;border-bottom:1px solid #eef1f4}
#fofa-toolbox-box .fx-l-ghead td span,#fofa-preset-mgr .fx-l-ghead td span{color:#8b949e;font-weight:400;margin-left:6px}
#fofa-toolbox-box .fx-e-group.fx-e-hl{border-color:#f1961f;box-shadow:0 0 0 1.5px rgba(241,150,31,.4)}
#fofa-toolbox-box .fx-l-folders,#fofa-toolbox-box .fx-k-folders{display:flex;gap:6px;padding:8px 12px 0;flex-wrap:wrap}
#fofa-toolbox-box .fx-l-fchip{border:1px solid #d0d7de;background:#f6f8fa;border-radius:14px;padding:2px 10px;
  cursor:pointer;font:12px/1.4 inherit;color:#57606a;white-space:nowrap}
#fofa-toolbox-box .fx-l-fchip:hover{background:#eef1f4}
#fofa-toolbox-box .fx-l-fchip.on{background:#f1961f;border-color:#f1961f;color:#fff;font-weight:600}
#fofa-toolbox-box .fx-l-ops b.fx-l-filebtn:hover{color:#b25e09}
#fofa-toolbox-box .fx-l-selbar{display:flex;gap:6px;padding:8px 12px 0;align-items:center;flex-wrap:wrap}
#fofa-toolbox-box .fx-l-selbar .fx-l-selcnt{color:#57606a}
#fofa-toolbox-box .fx-l-selbar .fx-l-selcnt b{color:#b25e09}
#fofa-toolbox-box .fx-l-selbar button{border:1px solid #d0d7de;background:#f6f8fa;border-radius:6px;padding:4px 10px;
  cursor:pointer;font:12px/1.4 inherit;color:#24292f;white-space:nowrap}
#fofa-toolbox-box .fx-l-selbar button:hover{background:#eef1f4}
#fofa-toolbox-box .fx-l-selbar .fx-l-selmove{background:#f1961f;border-color:#f1961f;color:#fff;font-weight:600}
#fofa-toolbox-box .fx-l-selbar .fx-l-selmove:hover{background:#ffab2e;border-color:#ffab2e}
#fofa-toolbox-box td.fx-l-sel{text-align:center;width:26px}
#fofa-toolbox-box td.fx-l-sel input{margin:0;accent-color:#f1961f;cursor:pointer}
#fofa-toolbox-box .fx-l-quickbox{display:flex;gap:6px;padding:6px 12px 0;flex-wrap:wrap}
#fofa-toolbox-box .fx-l-quickbox button{border:1px solid #d0d7de;background:#f6f8fa;border-radius:6px;padding:4px 10px;
  cursor:pointer;font:12px/1.4 inherit;color:#24292f;white-space:nowrap}
#fofa-toolbox-box .fx-l-quickbox button:hover{background:#eef1f4}
#fofa-toolbox-box .fx-l-ops b.fx-l-toedit:hover{color:#f1961f}
#fofa-toolbox-box .fx-e-pmgr{margin-top:4px;border-top:1px dashed #eef1f4;padding-top:4px}
#fofa-toolbox-box .fx-e-pmgr b{color:#57606a;cursor:pointer;font-weight:600}
#fofa-toolbox-box .fx-e-pmgr b:hover{color:#f1961f}
#fofa-preset-mgr{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;width:860px;
  max-width:94vw;height:560px;max-height:84vh;display:flex;flex-direction:column;background:#fff;color:#24292f;
  border:1px solid #d0d7de;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden;
  font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
#fofa-preset-mgr .fx-m-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #eef1f4}
#fofa-preset-mgr .fx-m-title{font-weight:600;white-space:nowrap}
#fofa-preset-mgr .fx-m-search{flex:1;min-width:170px;border:1px solid #d0d7de;border-radius:6px;padding:4px 8px;
  font:12px/1.4 inherit;background:#fff;color:#24292f;outline:none}
#fofa-preset-mgr .fx-m-search:focus{border-color:#f1961f}
#fofa-preset-mgr .fx-l-hbtns button{border:1px solid #d0d7de;background:#f6f8fa;border-radius:6px;padding:4px 10px;
  cursor:pointer;font:12px/1.4 inherit;color:#24292f}
#fofa-preset-mgr .fx-l-hbtns button:hover{background:#eef1f4}
#fofa-preset-mgr .fx-m-tools{display:flex;gap:6px;padding:8px 12px 0;align-items:center;flex-wrap:wrap}
#fofa-preset-mgr .fx-l-count{color:#8b949e;font-size:11px}
#fofa-preset-mgr .fx-m-tools button{border:1px solid #d0d7de;background:#f6f8fa;border-radius:6px;padding:4px 10px;
  cursor:pointer;font:12px/1.4 inherit;color:#24292f;white-space:nowrap}
#fofa-preset-mgr .fx-m-tools button:hover{background:#eef1f4}
#fofa-preset-mgr .fx-m-tablewrap{flex:1;min-height:0;overflow:auto;margin-top:6px}
#fofa-preset-mgr .fx-l-table{border-collapse:collapse;width:100%}
#fofa-preset-mgr .fx-l-table th{position:sticky;top:0;background:#f6f8fa;color:#57606a;font-weight:600;text-align:left;
  padding:6px 8px;border-bottom:1px solid #eef1f4;white-space:nowrap}
#fofa-preset-mgr .fx-l-table td{padding:5px 8px;border-bottom:1px solid #f0f2f5;vertical-align:top;word-break:break-all}
#fofa-preset-mgr .fx-l-table td[contenteditable]:focus{outline:1.5px solid #f1961f;outline-offset:-1.5px;background:#fffdf5}
#fofa-preset-mgr .fx-l-mono{font-family:Consolas,Menlo,monospace;font-size:11px}
#fofa-preset-mgr .fx-l-ops b{cursor:pointer;color:#8b949e;font-weight:400;margin-right:6px}
#fofa-preset-mgr .fx-l-ops b:hover{color:#f1961f}
#fofa-preset-mgr .fx-l-ops b.fx-m-pdel:hover{color:#e5484d}
#fofa-preset-mgr .fx-l-ops b.fx-m-pins,#fofa-preset-mgr .fx-l-ops b.fx-m-povr{color:#b25e09}
#fofa-preset-mgr td.fx-rowdrag{cursor:grab;color:#c4cdd5;text-align:center;user-select:none;font-size:13px}
#fofa-preset-mgr td.fx-rowdrag:active{cursor:grabbing;color:#f1961f}
#fofa-preset-mgr tr.fx-dragging td{opacity:.45}
#fofa-preset-mgr tr.fx-drop-above td{border-top:2px solid #f1961f}
#fofa-preset-mgr tr.fx-drop-below td{border-bottom:2px solid #f1961f}
#fofa-preset-mgr .fx-l-empty{color:#8b949e;text-align:center;padding:24px}
#fofa-preset-mgr .fx-l-foot{padding:6px 12px;color:#8b949e;font-size:11px;border-top:1px solid #eef1f4}
#fofa-preset-mgr tr.fx-m-peditor td{background:#fffdf5;padding:0 6px 6px}
#fofa-preset-mgr .fx-e-cards{max-height:190px;overflow:auto}
#fofa-preset-mgr .fx-e-qtext{min-height:40px;max-height:110px}
#fofa-preset-mgr .fx-e-pactions{display:flex;gap:6px;padding:6px 12px 8px}
#fofa-preset-mgr .fx-e-pactions button{border:1px solid #d0d7de;background:#f6f8fa;border-radius:6px;padding:4px 10px;
  cursor:pointer;font:12px/1.4 inherit;color:#24292f;white-space:nowrap}
#fofa-preset-mgr .fx-e-pactions .fx-e-psave2{background:#f1961f;border-color:#f1961f;color:#fff;font-weight:600}
#fofa-preset-mgr .fx-e-pactions .fx-e-psave2:hover{background:#ffab2e;border-color:#ffab2e}`;
      (document.head || document.documentElement).appendChild(toolboxStyle);
    }
  }

  /* FOFA（Nuxt/unhead）注水时会清理 head 里的未知标签，样式一旦被摘掉，
     指纹库面板/徽标/按钮会退化成页面底部的无样式内容块（刷新后“静态镶嵌”在页面上，
     手动开关面板才会恢复——因为只有那时才重新注入样式）。盯住 head 被删即补回，
     另由周期检查兜底（MutationObserver 自身追加样式也会触发回调，但 isConnected 检查使其空转）。 */
  new MutationObserver(() => injectStyle())
    .observe(document.head || document.documentElement, { childList: true });

  function hideMenu() {
    if (menu) { menu.remove(); menu = null; }
  }

  /* 或包含（||）合成：基于字段卡解析（解析器以函数声明定义在编辑器一节，调用时有提升）。
     当前语句里有同字段的「或组」时，把条件并进该组（重新合成后自然落在括号内、
     与其他同类条件并列，已存在则不重复添加）；没有可并的或组、或条件不可解析时，
     把当前语句整体括起来再或，保证 || 不因优先级被 && 吞掉 */
  function orCompose(cur, cond) {
    const row = parseCondOne(cond);
    const cards = parseQueryToCards(cur || '');
    const tgt = row && row.field
      && cards.find((c) => c.raw == null && c.field.toLowerCase() === row.field.toLowerCase() && c.join === '||');
    if (!tgt) return cur ? `(${cur}) || ${cond}` : cond;
    if (!tgt.rows.some((r) => r.op === row.op && r.value === row.value)) tgt.rows.push({ op: row.op, value: row.value });
    return cardsToQuery(cards);
  }

  function showMenu(x, y, cand) {
    hideMenu();
    injectStyle();

    menu = document.createElement('div');
    menu.id = 'fofa-toolbox-menu';
    menu.innerHTML = `
      <input class="fx-cond" spellcheck="false" placeholder='例如 product="HIKVISION-视频监控" 或 icon_hash="-1940193079"'>
      <div class="fx-btns">
        <button class="fx-primary" title="将该条件取反后追加到当前语句，并在新标签页打开">🚫 排除并打开</button>
        <button class="fx-inc" title="将该条件以 且(&amp;&amp;) 追加到当前语句，并在新标签页打开">➕ 且包含</button>
        <button class="fx-or" title="将该条件以 或(||) 并入当前语句：优先并入语句里同字段的或组（括号内，与其他同类条件并列），没有可并的或组时把当前语句整体括起来再或">➕ 或包含</button>
      </div>
      <div class="fx-btns">
        <button class="fx-eedit-ex" title="把该条件取反后作为字段卡并入查询编辑器（同字段自动集中一卡、去重；工具箱没开会自动打开），不新开标签">✏️ 排除到编辑器</button>
        <button class="fx-eedit-in" title="把该条件作为字段卡并入查询编辑器（同字段自动集中一卡、去重；工具箱没开会自动打开），不新开标签">✏️ 包含到编辑器</button>
      </div>
      <div class="fx-foot">
        <label class="fx-curwin" title="勾选后在当前标签页内跳转，不再新开标签"><input type="checkbox">在本页打开</label>
        <span title="按住 Alt 用左键拖拽出一块区域，批量识别其中可排除的对象">Alt+拖拽=框选批量</span><span>v${VER}</span>
      </div>`;

    const input = menu.querySelector('.fx-cond');
    input.value = cand.cond;
    let edited = false;
    input.addEventListener('input', () => { edited = true; });

    const curwin = menu.querySelector('.fx-curwin input');
    curwin.checked = openInCurrent();
    curwin.addEventListener('change', () => {
      try { sessionStorage.setItem(CURWIN_KEY, curwin.checked ? '1' : '0'); } catch (e) { /* ignore */ }
    });

    const getCond = () => input.value.replace(/\s+/g, ' ').trim();
    // 自引用条件（当前语句已含）：排除且未编辑时就地取反（避免追加后自相矛盾）；
    // 包含一律照常追加——就地替换对包含是把条件换成它自己，等于什么都没做
    const compose = (cond, mode) => {
      if (!cand.cur) return cond;
      if (mode === 'exclude' && cand.replace && !edited) return cand.cur.replace(cand.replace, cond);
      if (mode === 'or') return orCompose(cand.cur, cond);
      return `${cand.cur} && ${cond}`;
    };
    if (cand.replace) {
      const btn = menu.querySelector('.fx-primary');
      btn.title = '当前语句已包含此条件：把它就地取反后打开（而非追加）';
    }
    console.info(`[FOFA工具箱] v${VER} 右键菜单：cur长度=${(cand.cur || '').length}，replace=${cand.replace || '无'}，cond=${cand.cond}`);

    const doOpen = (mode) => {
      const cond = getCond();
      if (!cond) { input.focus(); return; }
      // 包含（且/或）：未编辑时用链接里的原始条件（保留 FOFA 的 == 精确匹配语义）
      const final = mode === 'exclude' ? ensureNeg(cond) : (!edited && cand.include ? cand.include : ensurePos(cond));
      const q = compose(final, mode);
      const label = mode === 'exclude' ? '排除' : (mode === 'or' ? '或包含' : '且包含');
      console.info(`[FOFA工具箱] v${VER} ${label} -> ${q}`);
      openTab(q);
      hideMenu();
    };

    menu.querySelector('.fx-primary').addEventListener('click', () => doOpen('exclude'));
    menu.querySelector('.fx-inc').addEventListener('click', () => doOpen('include'));
    menu.querySelector('.fx-or').addEventListener('click', () => doOpen('or'));
    // 发送到查询编辑器：不打开新标签，作为字段卡并入主编辑器（工具箱没开会自动打开）
    const doEdit = (mode) => {
      const cond = getCond();
      if (!cond) { input.focus(); return; }
      const final = mode === 'exclude' ? ensureNeg(cond) : (!edited && cand.include ? cand.include : ensurePos(cond));
      console.info(`[FOFA工具箱] v${VER} ${mode === 'exclude' ? '排除' : '包含'}到编辑器 -> ${final}`);
      editorAppend([final], mode);
      hideMenu();
    };
    menu.querySelector('.fx-eedit-ex').addEventListener('click', () => doEdit('exclude'));
    menu.querySelector('.fx-eedit-in').addEventListener('click', () => doEdit('include'));
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); doOpen('exclude'); }
    });

    document.documentElement.appendChild(menu);

    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
    input.focus();
    if (cand.cond) input.select();
  }

  /* ---------------- 批量暂存：右下角徽标 + 面板 ---------------- */

  function hideStagePanel() {
    const p = document.getElementById('fofa-toolbox-stage-panel');
    if (p) p.remove();
  }

  function ensureStagedBar() {
    const n = loadStaged().length;
    let bar = document.getElementById('fofa-toolbox-stage-bar');
    if (!n) {
      if (bar) bar.remove();
      hideStagePanel();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'fofa-toolbox-stage-bar';
      bar.title = '已暂存的条件，点击批量排除/包含（也可并入查询编辑器）';
      bar.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = document.getElementById('fofa-toolbox-stage-panel');
        if (p) hideStagePanel(); else showStagePanel();
      });
      document.documentElement.appendChild(bar);
    }
    bar.textContent = '📥 ' + n;
  }

  function showStagePanel() {
    hideStagePanel();
    injectStyle();
    const arr = loadStaged();
    const panel = document.createElement('div');
    panel.id = 'fofa-toolbox-stage-panel';
    panel.innerHTML = `
      <div class="fx-p-title">已暂存 ${arr.length} 个条件（排除时已存在于当前语句的会被就地取反；也可并入查询编辑器继续编辑）</div>
      <div class="fx-p-list">${arr.map((c, i) =>
        `<div class="fx-p-item"><span title="${esc(c)}">${esc(c)}</span><b data-i="${i}" title="移除">×</b></div>`
      ).join('')}</div>
      <div class="fx-p-btns">
        <button class="fx-p-primary" title="把全部暂存条件取反后并入当前语句并打开">🚫 全部排除并打开</button>
        <button class="fx-p-inc" title="把全部暂存条件并入当前语句并打开（同字段多值自动用 || 并列加括号）">➕ 全部包含</button>
        <button class="fx-p-eexclude" title="把全部暂存条件取反后作为字段卡并入查询编辑器：同字段自动集中一卡、去重；工具箱没开会自动打开，不新开标签">✏️ 排除到编辑器</button>
        <button class="fx-p-einclude" title="把全部暂存条件作为字段卡并入查询编辑器：同字段多值自动并列成或卡（加括号）、去重；工具箱没开会自动打开，不新开标签">✏️ 包含到编辑器</button>
        <button class="fx-p-clear" title="清空暂存">清空</button>
      </div>`;

    panel.addEventListener('click', (e) => {
      const rm = e.target.closest && e.target.closest('.fx-p-item b');
      if (rm) {
        const a = loadStaged();
        a.splice(Number(rm.dataset.i), 1);
        saveStaged(a);
        ensureStagedBar();
        if (a.length) showStagePanel(); else hideStagePanel();
        return;
      }
      const apply = (mode) => {
        const q = applyBatch(currentQuery(), loadStaged(), mode);
        saveStaged([]);
        ensureStagedBar();
        hideStagePanel();
        if (q) openTab(q);
      };
      // 并入查询编辑器：消耗暂存（同排除/包含并打开的语义），不新开标签
      const toEditor = (mode) => {
        const conds = loadStaged();
        editorAppend(conds, mode);
        saveStaged([]);
        ensureStagedBar();
        hideStagePanel();
      };
      if (e.target.closest('.fx-p-primary')) apply('exclude');
      else if (e.target.closest('.fx-p-inc')) apply('include');
      else if (e.target.closest('.fx-p-eexclude')) toEditor('exclude');
      else if (e.target.closest('.fx-p-einclude')) toEditor('include');
      else if (e.target.closest('.fx-p-clear')) { saveStaged([]); ensureStagedBar(); }
    });

    document.documentElement.appendChild(panel);
  }

  setInterval(ensureStagedBar, 2000); // SPA 重渲染后补回徽标
  ensureStagedBar();

  /* ---------------- 指纹收藏库 ----------------
     记录搜索语句（指纹），自动抓取：独立IP数、产品排名（第一名+同位数）、
     国家/地区排名（第一名+同位数，如 3000/2000/999 -> 前两者）、Server、Title；
     另有厂商/型号/备注等手动字段。表格式编辑，localStorage 持久化，JSON/CSV 导出。 */

  const LIB_KEY = 'fofa-toolbox-fingerprints';
  let libUndoSnap = null; // 全库去重前的整库快照（工具栏 ↩ 用）
  const libRowUndo = new Map(); // 单条去重前的语句：id -> 原 query（行内 ↩ 用，仅本页会话内有效）
  const LIB_FIELDS = [
    { key: 'name', label: '名称', w: '80px' },
    { key: 'query', label: '搜索语句', w: '180px', mono: true },
    { key: 'ip', label: 'IP数', w: '60px' },
    { key: 'product', label: '产品', w: '100px' },
    { key: 'category', label: '类型', w: '90px' },
    { key: 'region', label: '国家', w: '90px' },
    { key: 'server', label: 'Server', w: '70px' },
    { key: 'title', label: 'Title', w: '100px' },
    { key: 'after', label: '收录时间', w: '80px' },
    { key: 'vendor', label: '厂商', w: '60px' },
    { key: 'model', label: '型号', w: '60px' },
    { key: 'note', label: '备注', w: '80px' },
    { key: 'folder', label: '文件夹', w: '70px' }
  ];

  function loadLib() {
    try { const a = JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function saveLib(arr) {
    try { localStorage.setItem(LIB_KEY, JSON.stringify(arr)); } catch (e) { /* ignore */ }
  }

  // 从结果页头部抓 “N 条匹配结果 / (M 条独立IP)”（未登录时 FOFA 显示 *）
  function grabCounts() {
    const t = document.body ? (document.body.innerText || '') : '';
    const num = (re) => {
      const m = re.exec(t);
      return m ? m[1].replace(/[,，\s]/g, '') : '';
    };
    return { total: num(/([\d,，*]+)\s*条匹配结果/), ip: num(/([\d,，*]+)\s*条独立\s*IP/) };
  }

  // 侧栏某个排名区块的条目 [{name, count}]（count 已去掉千分位逗号）
  function grabRankingEntries(kw) {
    const secs = Array.from(document.querySelectorAll('.hsxa-meta-data-statistical-list .hsxa-list-main'))
      .filter((s) => s.offsetHeight > 0);
    const sec = secs.find((x) => ((((x.querySelector('.summary-title-content') || {}).textContent) || '').indexOf(kw) >= 0));
    if (!sec) return [];
    return Array.from(sec.querySelectorAll('li')).map((li) => {
      const a = li.querySelector('a');
      const cnt = li.querySelector('.titleRight') || li.querySelector('span[style*="flex"]');
      return { name: a ? a.textContent.trim() : '', count: (cnt ? cnt.textContent : '').replace(/[,，\s]/g, '') };
    }).filter((x) => x.name);
  }

  // 第一名 + 与第一名计数位数相同的条目（如 美国3000/中国2000/印度999 -> 美国、中国）
  function pickTopSameDigits(entries) {
    if (!entries.length) return [];
    const digits = (v) => String(v).replace(/\D/g, '').length;
    const d0 = digits(entries[0].count);
    if (!d0) return [entries[0].name]; // 游客等场景计数不可见
    return entries.filter((x) => digits(x.count) === d0).map((x) => x.name);
  }

  // 查询语句里的 app= / product= 视为产品（FOFA 中两者同义）
  function productFromQuery(q) {
    const m = /(?:^|[^A-Za-z_.])(?:app|product)\s*={1,2}(?!=)\s*"([^"]+)"/.exec(q || '');
    return m ? m[1] : '';
  }

  // 查询语句里的 after=（收录时间）
  function afterFromQuery(q) {
    const m = /(?:^|[^A-Za-z_.])after\s*={1,2}(?!=)\s*"([^"]+)"/.exec(q || '');
    return m ? m[1] : '';
  }

  // 名称填写规则：产品唯一（语句里只有一个 app=/product=），或产品排名里
  // 第一名的计数位数严格多于其他（独一档）时填入，其余留空
  function pickName(productFromQ, entries) {
    if (productFromQ) return productFromQ;
    if (!entries.length) return '';
    if (entries.length === 1) return entries[0].name;
    const digits = (v) => String(v).replace(/\D/g, '').length;
    if (digits(entries[0].count) > digits((entries[1] || {}).count || '')) return entries[0].name;
    return '';
  }

  // 从当前页面抓一条指纹记录（当前语句 + 独立IP + 各排名信息）
  function captureFingerprint() {
    const q = currentQuery();
    if (!q) return null;
    const c = grabCounts();
    // 骨架渲染期计数可能显示 0，视为未知存空
    const clean = (v) => (v && v !== '0' ? v : '');
    const productEntries = grabRankingEntries('产品');
    const entry = {
      id: Date.now(),
      name: pickName(productFromQuery(q), productEntries),
      query: q,
      ip: clean(c.ip) || clean(c.total),
      // 产品优先取语句里的 app=/product=，没有对应内容时才用产品排名，再没有就留空
      product: productFromQuery(q) || pickTopSameDigits(productEntries).join('、'),
      // 类型：分类排名里的名字（不带数量）
      category: grabRankingEntries('分类').map((x) => x.name).join('、'),
      region: pickTopSameDigits(grabRankingEntries('国家')).join('、'),
      server: (grabRankingEntries('Server')[0] || {}).name || '',
      title: (grabRankingEntries('网站标题')[0] || {}).name || '',
      // 收录时间直接记录收藏当天的系统日期
      after: fmtDate(new Date()),
      vendor: '', model: '', note: '', folder: '',
      ts: new Date().toLocaleString()
    };
    return entry;
  }

  const csvCell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  function libToCsv(arr) {
    const head = LIB_FIELDS.map((f) => f.label).concat(['收藏时间']);
    const lines = [head.map(csvCell).join(',')];
    for (const it of arr) {
      lines.push(LIB_FIELDS.map((f) => it[f.key]).concat([it.ts]).map(csvCell).join(','));
    }
    return '\ufeff' + lines.join('\r\n');
  }

  function downloadFile(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  let boxUserClosed = false; // 用户手动关过后，本页面会话不再自动弹出
  const LIB_POS_KEY = 'fofa-lib-pos';
  let libDrag = null; // {panel, dx, dy} 拖动状态（move/up 监听在 document 上，只注册一次）
  const BOX_SIZE_KEY = 'fofa-box-size';
  let boxResize = null; // {panel, x, y, w, h} 宽高调整状态

  function closeToolbox(byUser) {
    if (byUser) boxUserClosed = true;
    const p = document.getElementById('fofa-toolbox-box');
    if (p) p.remove();
  }

  // 上次拖动后保存的位置（有则沿用，越界时夹回视口内）
  function applySavedLibPos(panel) {
    try {
      const pos = JSON.parse(localStorage.getItem(LIB_POS_KEY) || 'null');
      if (pos && typeof pos.l === 'number' && typeof pos.t === 'number') {
        panel.style.left = Math.max(0, Math.min(pos.l, innerWidth - 100)) + 'px';
        panel.style.top = Math.max(0, Math.min(pos.t, innerHeight - 40)) + 'px';
        panel.style.transform = 'none';
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function resetLibPos(panel) {
    try {
      localStorage.removeItem(LIB_POS_KEY);
      localStorage.removeItem(BOX_SIZE_KEY);
    } catch (e) { /* ignore */ }
    panel.style.left = '';
    panel.style.top = '';
    panel.style.transform = '';
    panel.style.width = '';
    panel.style.height = '';
    panel.style.maxWidth = '';
    panel.style.maxHeight = '';
  }

  function attachToolboxDrag(panel) {
    // mousedown 委托在 panel 上（renderLib 重建内容不影响）；
    // 标题栏为拖动手柄，按钮区域不触发
    panel.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const head = e.target.closest && e.target.closest('.fx-l-head');
      if (!head || (e.target.closest && e.target.closest('button'))) return;
      const r = panel.getBoundingClientRect();
      panel.style.left = r.left + 'px';
      panel.style.top = r.top + 'px';
      panel.style.transform = 'none';
      libDrag = { panel, dx: e.clientX - r.left, dy: e.clientY - r.top };
      e.preventDefault();
    });
    // 双击标题栏（非按钮）复位到默认居中
    panel.addEventListener('dblclick', (e) => {
      const head = e.target.closest && e.target.closest('.fx-l-head');
      if (head && !(e.target.closest && e.target.closest('button'))) resetLibPos(panel);
    });
  }

  // 手工调整宽高：右下角把手拖动，尺寸记住；调整前先钉住左上角，避免居中 transform 跳动
  function applySavedBoxSize(panel) {
    try {
      const sz = JSON.parse(localStorage.getItem(BOX_SIZE_KEY) || 'null');
      if (sz && sz.w >= 420 && sz.h >= 260) {
        panel.style.width = Math.min(sz.w, innerWidth - 16) + 'px';
        panel.style.height = Math.min(sz.h, innerHeight - 16) + 'px';
        panel.style.maxWidth = 'none';
        panel.style.maxHeight = 'none';
      }
    } catch (e) { /* ignore */ }
  }

  function attachBoxResize(panel) {
    const grip = panel.querySelector('.fx-t-resize');
    if (!grip) return;
    grip.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const r = panel.getBoundingClientRect();
      panel.style.left = r.left + 'px';
      panel.style.top = r.top + 'px';
      panel.style.transform = 'none';
      boxResize = { panel, x: e.clientX, y: e.clientY, w: r.width, h: r.height };
    });
  }

  document.addEventListener('mousemove', (e) => {
    if (boxResize) {
      const p = boxResize.panel;
      const w = Math.max(420, Math.min(boxResize.w + e.clientX - boxResize.x, innerWidth - 8));
      const h = Math.max(260, Math.min(boxResize.h + e.clientY - boxResize.y, innerHeight - 8));
      p.style.width = w + 'px';
      p.style.height = h + 'px';
      p.style.maxWidth = 'none'; // 手工尺寸自行按视口钳制，解除 CSS 上限
      p.style.maxHeight = 'none';
      return;
    }
    if (!libDrag) return;
    const p = libDrag.panel;
    const l = Math.max(60 - p.offsetWidth, Math.min(e.clientX - libDrag.dx, innerWidth - 60));
    const t = Math.max(0, Math.min(e.clientY - libDrag.dy, innerHeight - 36));
    p.style.left = l + 'px';
    p.style.top = t + 'px';
  }, true);

  document.addEventListener('mouseup', () => {
    if (boxResize) {
      const p = boxResize.panel;
      boxResize = null;
      try {
        localStorage.setItem(BOX_SIZE_KEY, JSON.stringify({ w: p.offsetWidth, h: p.offsetHeight }));
      } catch (e) { /* ignore */ }
    }
    if (!libDrag) return;
    const p = libDrag.panel;
    libDrag = null;
    try {
      localStorage.setItem(LIB_POS_KEY, JSON.stringify({ l: parseInt(p.style.left, 10) || 0, t: parseInt(p.style.top, 10) || 0 }));
    } catch (e) { /* ignore */ }
  }, true);

  let toolboxTab = 'lib'; // 上次使用的标签页：lib=指纹库 edit=查询编辑器

  function openToolbox(lower, tab) {
    closeToolbox(false);
    injectStyle();
    const panel = document.createElement('div');
    panel.id = 'fofa-toolbox-box';
    if (lower) panel.classList.add('fx-l-lower'); // 首页：中间偏下
    panel.innerHTML = `
      <div class="fx-l-head">
        <span class="fx-l-title">🧰 FOFA 工具箱</span>
        <span class="fx-t-tabs">
          <button class="fx-t-tab fx-t-tab-lib" data-tab="lib" title="指纹收藏库">🗂 指纹库</button>
          <button class="fx-t-tab fx-t-tab-edit" data-tab="edit" title="结构化编辑当前搜索语句并发起查询">✏️ 查询编辑器</button>
          <button class="fx-t-tab fx-t-tab-kb" data-tab="kb" title="厂商贴牌关系与产品特征（Server/Title/截图）">📚 知识库</button>
        </span>
        <span class="fx-l-hbtns"><button class="fx-l-close" title="收起工具箱（Esc）">关闭</button></span>
      </div>
      <div class="fx-t-body">
        <div class="fx-t-pane fx-t-pane-lib"></div>
        <div class="fx-t-pane fx-t-pane-edit"></div>
        <div class="fx-t-pane fx-t-pane-kb"></div>
      </div>
      <div class="fx-t-resize" title="拖动调整宽高（双击标题栏恢复默认尺寸与居中）"></div>`;
    renderLib(panel.querySelector('.fx-t-pane-lib'));
    attachLibEvents(panel.querySelector('.fx-t-pane-lib')); // 只挂一次
    buildEditor(panel.querySelector('.fx-t-pane-edit'));
    buildKb(panel.querySelector('.fx-t-pane-kb'));
    panel.querySelector('.fx-l-close').addEventListener('click', () => closeToolbox(true));
    panel.querySelectorAll('.fx-t-tab').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    attachToolboxDrag(panel);
    applySavedLibPos(panel);
    applySavedBoxSize(panel);
    attachBoxResize(panel);
    document.documentElement.appendChild(panel);
    switchTab(tab || toolboxTab);
  }

  const TOOLBOX_TABS = ['lib', 'edit', 'kb'];
  function switchTab(tab) {
    toolboxTab = tab;
    const box = document.getElementById('fofa-toolbox-box');
    if (!box) return;
    for (const t of TOOLBOX_TABS) {
      box.querySelector('.fx-t-tab-' + t).classList.toggle('on', tab === t);
      box.querySelector('.fx-t-pane-' + t).classList.toggle('on', tab === t);
    }
    // 自动跟随模式下页面语句变了（如搜索后跳转）才重读；显式载入过内容
    //（指纹 / 预设覆盖 / 空白查询）就不再自动重读，想拉页面语句点「↻ 使用当前查询语句」
    if (tab === 'edit' && editMain && editMain.pageChanged()) editMain.parseFromPage();
  }

  /* ---------- 内置日期语法 ----------
     内置占位语法（仅在 after 的值内识别，不误伤普通文本）：
       YESTERDAY -> 系统昨天的日期；LastMonth -> 系统时间的一个月前（月末日钳制）；
       每行 📅 把语句中 after 的日期整体替换为一月前再搜索；
       操作栏 📌 可把任意条目置顶/取消置顶。 */

  function fmtDate(d) {
    const p = (n) => (n < 10 ? '0' + n : String(n));
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function monthAgoOf(now) {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    first.setDate(Math.min(now.getDate(), lastDay));
    return fmtDate(first);
  }

  // 在 after 的值内替换内置占位语法（不区分大小写）
  function substituteBuiltinSyntax(val, now) {
    const yesterday = fmtDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    return String(val || '')
      .replace(/yesterday/gi, yesterday)
      .replace(/lastmonth/gi, monthAgoOf(now));
  }

  const AFTER_VAL_RE = /(after\s*={1,2}(?!=)\s*")([^"]*)(")/g;

  // monthMode: 把 after 的日期值整体替换为一月前；
  // 否则仅在 after 值内替换 YESTERDAY / LastMonth 占位符
  function resolveQuery(q, monthMode, now) {
    now = now || new Date();
    let out = String(q || '');
    out = out.replace(AFTER_VAL_RE, (m, a, val, b) => a + (monthMode ? monthAgoOf(now) : substituteBuiltinSyntax(val, now)) + b);
    return out;
  }

  // 语句里是否用到内置占位语法（导出前询问用）
  function hasBuiltinSyntax(q) {
    let hit = false;
    String(q || '').replace(AFTER_VAL_RE, (m, a, val) => { if (/yesterday|lastmonth/i.test(val)) hit = true; return m; });
    return hit;
  }

  /* ---------------- 表格行拖动排序（指纹库/知识库共用） ----------------
     行首手柄（draggable）拖起，拖到目标行的上半/下半决定插到其前/其后；
     canDrop 校验约束（指纹库：同置顶状态；知识库：同母厂组），不满足则禁止放置；
     move 执行移动并负责保存与重绘 */
  function attachRowDrag(pane, canDrop, move) {
    let dragId = null;
    pane.addEventListener('dragstart', (e) => {
      const h = e.target.closest && e.target.closest('.fx-rowdrag');
      if (!h) return;
      const tr = h.closest('tr');
      dragId = tr.dataset.id;
      tr.classList.add('fx-dragging');
      try { e.dataTransfer.setData('text/plain', dragId); } catch (err) { /* Firefox 必需 */ }
      e.dataTransfer.effectAllowed = 'move';
    });
    pane.addEventListener('dragend', () => {
      dragId = null;
      pane.querySelectorAll('tr.fx-dragging,tr.fx-drop-above,tr.fx-drop-below').forEach((tr) =>
        tr.classList.remove('fx-dragging', 'fx-drop-above', 'fx-drop-below'));
    });
    const clearMarks = () => pane.querySelectorAll('tr.fx-drop-above,tr.fx-drop-below')
      .forEach((x) => x.classList.remove('fx-drop-above', 'fx-drop-below'));
    pane.addEventListener('dragover', (e) => {
      const tr = e.target.closest && e.target.closest('tr[data-id]');
      clearMarks();
      if (!dragId || !tr || tr.dataset.id === dragId || !canDrop(dragId, tr.dataset.id)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = tr.getBoundingClientRect();
      const before = (e.clientY - r.top) < r.height / 2;
      tr.classList.add(before ? 'fx-drop-above' : 'fx-drop-below');
      tr.dataset.dropBefore = before ? '1' : '0';
    });
    pane.addEventListener('drop', (e) => {
      const tr = e.target.closest && e.target.closest('tr[data-id]');
      if (!dragId || !tr || tr.dataset.id === dragId) return;
      e.preventDefault();
      const before = tr.dataset.dropBefore === '1';
      const id = dragId;
      dragId = null;
      pane.querySelectorAll('tr.fx-dragging,tr.fx-drop-above,tr.fx-drop-below').forEach((x) =>
        x.classList.remove('fx-dragging', 'fx-drop-above', 'fx-drop-below'));
      move(id, tr.dataset.id, before);
    });
  }

  // 搜索 + 文件夹视图过滤：按全部列内容（含文件夹名）匹配，置顶条目仍优先
  function libFiltered(filter, folderView) {
    const kw = String(filter || '').trim().toLowerCase();
    const hit = (it) => inFolderView(it, folderView)
      && (!kw || LIB_FIELDS.some((f) => String(it[f.key] || '').toLowerCase().includes(kw)));
    return loadLib().filter(hit).slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0));
  }

  function renderLib(pane) {
    const arr = loadLib();
    // 工具栏（含搜索框、快速操作下拉）只建一次：输入搜索词时仅重绘表格区，输入框焦点不丢。
    // 事件在 openToolbox 里对 pane 挂一次（委托，重渲染不影响）
    if (!pane.querySelector('.fx-l-tablewrap')) {
      pane.innerHTML = `
      <div class="fx-l-tools">
        <input class="fx-l-libsearch" placeholder="搜索：名称 / 语句 / 产品 / 类型 / 国家 / 厂商 / 文件夹…" spellcheck="false" title="按任意列内容实时过滤（含文件夹名；置顶条目仍优先）">
        <span class="fx-l-count"></span>
        <button class="fx-l-add" title="新建条目：结果页会自动填写当前语句与排名信息，否则为空白；在某个文件夹视图里新建会自动归档进该文件夹">＋ 新建</button>
        <button class="fx-l-quickbtn" title="批量操作：整理全库语句（可 ↩ 撤销）/ 批量移动到文件夹等">⚡ 快速操作</button>
        <button class="fx-l-expj" title="导出为 JSON 文件">导出 JSON</button>
        <button class="fx-l-expc" title="导出为 CSV 文件（Excel 可直接打开）">导出 CSV</button>
        <button class="fx-l-imp" title="从本脚本导出的 JSON/CSV 文件导入（Excel 另存的 GBK 编码 CSV 也能识别）：按搜索语句去重，已存在的自动跳过">导入</button>
        <button class="fx-l-undo" style="display:none" title="恢复最近一次语句类快速操作（全库去重/删除地区等，不含批量移动）前的完整备份（会覆盖其后的修改）">↩ 撤销</button>
      </div>
      <div class="fx-l-quickbox" style="display:none">
        <button data-op="dedup" title="对所有条目的语句执行去重瘦身：同字段只保留最后一条定位条件、丢弃中间排除与冗余分类；完成后可「↩ 撤销」">🧹 全库去重</button>
        <button data-op="dropcountry" title="去掉每条语句里全部 country 条件（或组/单条/排除都删，其他字段与原样片段不动）；完成后可「↩ 撤销」">🌏 删除地区</button>
        <button data-sop="move" title="进入批量选择：勾选条目后统一移动到某个文件夹（搜索 / 文件夹视图可先过滤再全选，实现按条件批量归档）">📦 批量移动</button>
      </div>
      <div class="fx-l-folders"></div>
      <div class="fx-l-selbar" style="display:none"></div>
      <div class="fx-l-tablewrap"></div>
      <div class="fx-l-foot">顶部文件夹条切换视图（全部 / 未归档 / 各文件夹）· 行内 📁 把条目归档/移动到文件夹 · 搜索框实时过滤（任意列 + 文件夹名）· 单元格点击即可编辑，失焦自动保存 · 📌 置顶 · ✏️ 发送到查询编辑器 · 数据保存在浏览器本地（localStorage）</div>`;
      const si = pane.querySelector('.fx-l-libsearch');
      if (si && pane.dataset.filter) si.value = pane.dataset.filter;
    }
    const kw = String(pane.dataset.filter || '').trim();
    const view = pane.dataset.folder || ''; // ''=全部 '*'=未归档 其他=文件夹名
    // 文件夹筛选条：全部 / 未归档 / 各文件夹（含条数，点击切换）
    const folders = new Map();
    for (const it of arr) {
      const f = String(it.folder || '').trim();
      if (f) folders.set(f, (folders.get(f) || 0) + 1);
    }
    const unfiled = arr.filter((it) => !String(it.folder || '').trim()).length;
    const chip = (fo, label, on) => `<button class="fx-l-fchip${on ? ' on' : ''}" data-fo="${esc(fo)}">${esc(label)}</button>`;
    const fbar = pane.querySelector('.fx-l-folders');
    if (fbar) {
      fbar.innerHTML = chip('', `全部 (${arr.length})`, view === '')
        + chip('*', `未归档 (${unfiled})`, view === '*')
        + [...folders.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh'))
          .map(([f, n]) => chip(f, `📁 ${f} (${n})`, view === f)).join('');
      fbar.style.display = (folders.size || view === '*') ? '' : 'none'; // 一个文件夹都没有时收起
    }
    // 视图 + 搜索过滤；全部视图下按文件夹分组展示（📁 组头），其余视图不重复展示组头
    const sorted = libFiltered(pane.dataset.filter, view);
    const cols = LIB_FIELDS.filter((f) => f.key !== 'folder'); // 文件夹是导航不是列
    const groups = view === '' ? groupList(sorted, (it) => it.folder) : [{ group: '', items: sorted }];
    const showHeads = view === '' && (groups.length > 1 || groups.some((g) => g.group));
    const selecting = pane.dataset.selecting === '1'; // 批量选择模式：首列手柄换成复选框
    const lead = selecting
      ? (it) => `<td class="fx-l-sel"><input type="checkbox" title="选中以批量移动"></td>`
      : () => `<td class="fx-rowdrag" draggable="true" title="拖动调整顺序（同文件夹、同置顶状态内）">⠿</td>`;
    const rowOf = (it) => `<tr data-id="${it.id}"${it.pin ? ' class="fx-l-userpin"' : ''}>${lead(it)}${cols.map((f) =>
      `<td${f.mono ? ' class="fx-l-mono"' : ''} data-f="${f.key}" contenteditable="true" spellcheck="false">${esc(it[f.key] || '')}</td>`
    ).join('')}<td class="fx-l-ops"><b class="fx-l-filebtn" title="归档到文件夹：输入名字归档/移动，清空则移出文件夹">📁</b><b class="fx-l-pinbtn${it.pin ? ' on' : ''}" title="${it.pin ? '取消置顶' : '置顶'}">📌</b><b class="fx-l-toedit" title="把此语句发送到查询编辑器继续编辑（编辑器将脱离页面语句跟随）">✏️</b><b class="fx-l-search" title="用此语句搜索（YESTERDAY/LastMonth 自动替换为日期）">🔍</b><b class="fx-l-cal" title="把 after 日期替换为一月前再搜索">📅</b><b class="fx-l-dedup" title="语句去重瘦身：同字段只保留最后一条定位条件、丢弃中间排除与冗余分类；可撤销">🧹</b>${libRowUndo.has(String(it.id)) ? '<b class="fx-l-undorow" title="撤销本行去重，恢复原语句（会覆盖其后对此语句的修改）">↩</b>' : ''}<b class="fx-l-del" title="删除此条">✕</b></td></tr>`;
    let rows = '';
    for (const g of groups) {
      if (showHeads) rows += `<tr class="fx-l-ghead"><td colspan="${cols.length + 2}">📁 ${esc(g.group || '未归档')}<span>${g.items.length}</span></td></tr>`;
      rows += g.items.map(rowOf).join('');
    }
    pane.querySelector('.fx-l-tablewrap').innerHTML = `<table class="fx-l-table">
        <thead><tr><th style="width:26px"></th>${cols.map((f) => `<th style="width:${f.w}">${f.label}</th>`).join('')}<th>操作</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="${cols.length + 2}" class="fx-l-empty">${kw ? `没有匹配的条目：换个关键词，或清空搜索框显示全部 ${arr.length} 条` : (view ? '此视图暂无条目：点「＋ 新建」新建（会归入当前文件夹），或在其他视图用行内 📁 归档进来' : '暂无收藏条目：点「＋ 新建」即可收藏当前语句（结果页自动填写），或手动添加')}</td></tr>`}</tbody>
      </table>`;
    const cnt = pane.querySelector('.fx-l-count');
    if (cnt) cnt.textContent = kw ? `共 ${arr.length} 条，匹配 ${sorted.length} 条` : `共 ${arr.length} 条`;
    const ub = pane.querySelector('.fx-l-undo');
    if (ub) ub.style.display = libUndoSnap ? '' : 'none';
    updateSelBar(pane);
  }

  // 事件只在 openToolbox 时对 pane 挂一次。绝不能放进 renderLib：
  // renderLib 会被自身操作反复调用，重复挂载监听器会指数叠加（曾导致空条目爆炸、页面卡死）
  function attachLibEvents(pane) {
    // 单元格编辑（focusout 冒泡，一次委托即可）
    pane.addEventListener('focusout', (e) => {
      const td = e.target.closest && e.target.closest('td[contenteditable][data-f]');
      if (!td) return;
      const tr = td.closest('tr');
      const arr2 = loadLib();
      const it = arr2.find((x) => String(x.id) === tr.dataset.id);
      if (!it) return;
      it[td.dataset.f] = td.innerText.replace(/\u00a0/g, ' ').trim();
      saveLib(arr2);
    });

    // 搜索框实时过滤（只重绘表格区，输入框不动，焦点不丢）
    pane.addEventListener('input', (e) => {
      const si = e.target.closest && e.target.closest('.fx-l-libsearch');
      if (!si) return;
      pane.dataset.filter = si.value;
      renderLib(pane);
    });

    // 文件夹筛选条：切换视图（全部 / 未归档 / 各文件夹）
    pane.addEventListener('click', (e) => {
      const fc = e.target.closest && e.target.closest('.fx-l-fchip');
      if (!fc) return;
      pane.dataset.folder = fc.dataset.fo || '';
      renderLib(pane);
    });

    // 批量选择：勾选复选框时更新选择条计数
    pane.addEventListener('change', (e) => {
      if (e.target.closest && e.target.closest('td.fx-l-sel input')) updateSelBarCnt(pane);
    });

    // 拖动排序：同一文件夹、同一置顶状态内移动（跨边界不允许，否则稳定排序会把它弹回去）
    attachRowDrag(pane,
      (a, b) => {
        const arr2 = loadLib();
        const A = arr2.find((x) => String(x.id) === a);
        const B = arr2.find((x) => String(x.id) === b);
        return !!(A && B && (A.pin ? 1 : 0) === (B.pin ? 1 : 0) && String(A.folder || '') === String(B.folder || ''));
      },
      (id, targetId, before) => {
        const arr2 = loadLib();
        const drag = arr2.find((x) => String(x.id) === id);
        if (!drag) { renderLib(pane); return; }
        arr2.splice(arr2.indexOf(drag), 1);
        const ti = arr2.findIndex((x) => String(x.id) === targetId);
        if (ti < 0) { renderLib(pane); return; }
        arr2.splice(before ? ti : ti + 1, 0, drag);
        saveLib(arr2);
        renderLib(pane);
      });

    pane.addEventListener('click', (e) => {
      const del = e.target.closest && e.target.closest('.fx-l-del');
      if (del) {
        const id = del.closest('tr').dataset.id;
        saveLib(loadLib().filter((x) => String(x.id) !== id));
        renderLib(pane);
        return;
      }
      // 🧹：单条语句去重瘦身（撤销在该行操作栏 ↩）
      const dd = e.target.closest && e.target.closest('.fx-l-dedup');
      if (dd) {
        const arr2 = loadLib();
        const it = arr2.find((x) => String(x.id) === dd.closest('tr').dataset.id);
        if (!it || !it.query) return;
        const before = String(it.query).trim();
        const q2 = dedupeQuery(before);
        if (q2 === before) { importToast('此条语句没有可去重的内容'); return; }
        libRowUndo.set(String(it.id), before);
        it.query = q2;
        saveLib(arr2);
        renderLib(pane);
        importToast(`✅ 已去重（${before.length} 字 → <b>${q2.length}</b> 字），失误可点该行的 ↩`);
        return;
      }
      // ↩（行内）：撤销本行去重
      const undorow = e.target.closest && e.target.closest('.fx-l-undorow');
      if (undorow) {
        const id = undorow.closest('tr').dataset.id;
        const before = libRowUndo.get(String(id));
        const arr2 = loadLib();
        const it = arr2.find((x) => String(x.id) === id);
        if (it && before != null) {
          it.query = before;
          saveLib(arr2);
        }
        libRowUndo.delete(String(id));
        renderLib(pane);
        importToast('↩ 已恢复本行去重前的语句');
        return;
      }
      // ⚡ 快速操作：展开/收起操作下拉
      if (e.target.closest('.fx-l-quickbtn')) {
        const qb = pane.querySelector('.fx-l-quickbox');
        if (qb) qb.style.display = qb.style.display === 'none' ? '' : 'none';
        return;
      }
      // 📦 批量移动：进入批量选择模式（首列变复选框 + 选择条）
      if (e.target.closest && e.target.closest('.fx-l-quickbox button[data-sop="move"]')) {
        const qb = pane.querySelector('.fx-l-quickbox');
        if (qb) qb.style.display = 'none';
        pane.dataset.selecting = '1';
        renderLib(pane);
        importToast('☑ 已进入批量选择：勾选条目后点「📁 移动到文件夹…」（搜索 / 文件夹视图可先过滤再全选）');
        return;
      }
      // 批量选择条：退出 / 全选 / 移动到文件夹
      if (e.target.closest('.fx-l-selexit')) { delete pane.dataset.selecting; renderLib(pane); return; }
      if (e.target.closest('.fx-l-selall')) {
        const boxes = Array.from(pane.querySelectorAll('td.fx-l-sel input'));
        const all = boxes.length && boxes.every((b) => b.checked);
        boxes.forEach((b) => { b.checked = !all; });
        updateSelBarCnt(pane);
        return;
      }
      if (e.target.closest('.fx-l-selmove')) { batchMoveSelected(pane, loadLib, saveLib, renderLib); return; }
      // 语句类快速操作：对全库逐条套用（共用 ↩ 整库撤销）
      const qop = e.target.closest && e.target.closest('.fx-l-quickbox button[data-op]');
      if (qop) {
        const op = LIB_QUICK_OPS[qop.dataset.op];
        const qb = pane.querySelector('.fx-l-quickbox');
        if (qb) qb.style.display = 'none';
        if (op) libApplyQueryOp(pane, op.fn, op.label);
        return;
      }
      // ✏️：把此语句发送到查询编辑器继续编辑（编辑器脱离页面语句跟随）
      const toedit = e.target.closest && e.target.closest('.fx-l-toedit');
      if (toedit) {
        const it2 = loadLib().find((x) => String(x.id) === toedit.closest('tr').dataset.id);
        if (it2 && it2.query && editMain) {
          editMain.loadQuery(it2.query);
          switchTab('edit');
          importToast('✅ 已载入查询编辑器（不再跟随页面语句，「↻ 使用当前查询语句」可切回）');
        } else if (!it2 || !it2.query) importToast('⚠️ 此条没有搜索语句');
        return;
      }
      // ↩ 撤销去重
      if (e.target.closest('.fx-l-undo')) {
        if (!libUndoSnap) return;
        saveLib(libUndoSnap);
        libUndoSnap = null;
        renderLib(pane);
        importToast('↩ 已恢复去重前的指纹库');
        return;
      }
      // 📁：归档到文件夹（输入名字归档/移动；清空=移出文件夹；当前在某文件夹视图时预填其名）
      const fb = e.target.closest && e.target.closest('.fx-l-filebtn');
      if (fb) {
        const arr2 = loadLib();
        const it2 = arr2.find((x) => String(x.id) === fb.closest('tr').dataset.id);
        if (!it2) return;
        const curView = pane.dataset.folder || '';
        const pre = (curView && curView !== '*') ? curView : String(it2.folder || '').trim();
        const name = window.prompt('归档到哪个文件夹？（输入名字=归档/移动到该文件夹；清空=移出文件夹）', pre);
        if (name === null) return; // 取消
        it2.folder = name.trim();
        saveLib(arr2);
        renderLib(pane);
        importToast(it2.folder ? `📁 已归档到「${esc(it2.folder)}」` : '📁 已移出文件夹');
        return;
      }
      // 📌：置顶/取消置顶
      const pinBtn = e.target.closest && e.target.closest('.fx-l-pinbtn');
      if (pinBtn) {
        const id = pinBtn.closest('tr').dataset.id;
        const arr2 = loadLib();
        const it = arr2.find((x) => String(x.id) === id);
        if (it) { it.pin = !it.pin; saveLib(arr2); }
        renderLib(pane);
        return;
      }
      // 📅：after 替换为一月前再搜索
      const cal = e.target.closest && e.target.closest('.fx-l-cal');
      if (cal) {
        const q = (loadLib().find((x) => String(x.id) === cal.closest('tr').dataset.id) || {}).query || '';
        if (q) openTab(resolveQuery(q, true));
        return;
      }
      const search = e.target.closest && e.target.closest('.fx-l-search');
      if (search) {
        const q = (loadLib().find((x) => String(x.id) === search.closest('tr').dataset.id) || {}).query || '';
        if (q) openTab(resolveQuery(q, false));
        return;
      }
      if (e.target.closest('.fx-l-add')) {
        const arr2 = loadLib();
        // 结果页上自动填写当前语句与排名信息；无当前语句（如首页）则为空白条目；
        // 在某个文件夹视图里新建时自动归档进该文件夹
        const entry = captureFingerprint() || (() => {
          const blank = { id: Date.now(), ts: new Date().toLocaleString() };
          for (const f of LIB_FIELDS) blank[f.key] = '';
          return blank;
        })();
        const fv = pane.dataset.folder || '';
        entry.folder = (fv && fv !== '*') ? fv : '';
        arr2.unshift(entry);
        saveLib(arr2);
        const si = pane.querySelector('.fx-l-libsearch'); // 清掉过滤，保证新行可见
        if (si) { si.value = ''; pane.dataset.filter = ''; }
        renderLib(pane);
        // 置顶条目仍排在最前：按 id 定位新行聚焦，而不是表格第一行
        const cell = pane.querySelector(`tbody tr[data-id="${entry.id}"] td[contenteditable]`);
        if (cell) { cell.focus(); cell.scrollIntoView({ block: 'nearest' }); }
        return;
      }
      if (e.target.closest('.fx-l-expj')) { doExport('json'); return; }
      if (e.target.closest('.fx-l-expc')) { doExport('csv'); return; }
      if (e.target.closest('.fx-l-imp')) { doImport(pane); return; }
    });
  }

  // 导出：语句含内置语法（YESTERDAY / LastMonth）时询问处理方式
  function doExport(kind) {
    const arr = loadLib();
    const run = (resolve) => {
      const data = resolve
        ? arr.map((it) => Object.assign({}, it, { query: resolveQuery(it.query, false) }))
        : arr;
      if (kind === 'json') downloadFile('fofa-toolbox-fingerprints.json', JSON.stringify(data, null, 2), 'application/json');
      else downloadFile('fofa-toolbox-fingerprints.csv', libToCsv(data), 'text/csv');
    };
    if (arr.some((it) => hasBuiltinSyntax(it.query))) showExportChoice(run);
    else run(false);
  }

  function showExportChoice(run) {
    const old = document.getElementById('fofa-export-choice');
    if (old) old.remove();
    const dlg = document.createElement('div');
    dlg.id = 'fofa-export-choice';
    dlg.innerHTML = `
      <div class="fx-e-title">导出选项</div>
      <div class="fx-e-text">检测到搜索语句使用了内置语法（YESTERDAY / LastMonth）。导出时如何处理？</div>
      <div class="fx-e-btns">
        <button class="fx-e-resolve">替换为实际日期后导出</button>
        <button class="fx-e-raw">直接导出（保留内置语法）</button>
        <button class="fx-e-cancel">取消</button>
      </div>`;
    dlg.addEventListener('click', (e) => {
      if (e.target.closest('.fx-e-resolve')) { dlg.remove(); run(true); }
      else if (e.target.closest('.fx-e-raw')) { dlg.remove(); run(false); }
      else if (e.target.closest('.fx-e-cancel')) dlg.remove();
    });
    document.documentElement.appendChild(dlg);
  }

  /* ---------- 导入：JSON / CSV（与导出格式对称，按搜索语句去重合并） ---------- */

  // 解析 JSON 导出内容：数组，或 {items:[...]} 包装
  function parseImportJson(text) {
    let data;
    try { data = JSON.parse(text); }
    catch (e) { throw new Error('JSON 解析失败：' + e.message); }
    const arr = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : null);
    if (!arr) throw new Error('JSON 内容不是指纹库数组');
    return arr.filter((x) => x && typeof x === 'object');
  }

  // CSV 解析：支持引号包裹的逗号/双引号/换行（与 libToCsv 导出格式对称）
  function parseImportCsv(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
    const rows = [];
    let row = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += c;
      } else if (c === '"' && cell === '') inQ = true; // 引号只在字段开头才有定界作用；手写 CSV 里 app="A" 的引号按字面保留
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.length > 1 || row[0] !== '') rows.push(row); // 跳过空行
        row = [];
      } else cell += c;
    }
    if (cell !== '' || row.length) {
      row.push(cell);
      if (row.length > 1 || row[0] !== '') rows.push(row);
    }
    if (rows.length < 2) throw new Error('CSV 中没有数据行');
    // 表头：本脚本导出的中文列名，或直接用英文字段名
    const keyOf = {};
    for (const f of LIB_FIELDS) { keyOf[f.label] = f.key; keyOf[f.key] = f.key; }
    keyOf['收藏时间'] = 'ts';
    const head = rows[0].map((h) => keyOf[String(h).trim()] || null);
    if (!head.includes('query')) throw new Error('CSV 表头缺少「搜索语句」列');
    return rows.slice(1).map((r) => {
      const o = {};
      head.forEach((k, i) => { if (k) o[k] = r[i] == null ? '' : r[i]; });
      return o;
    });
  }

  // 按扩展名/内容嗅探分发（注意：本函数会被测试脚本按大括号配对截取，注释和字符串里不能出现不配对的花括号）
  function parseImport(text, fname) {
    text = String(text).replace(/^\ufeff/, '').trim();
    if (!text) throw new Error('文件内容为空');
    const c0 = text.charCodeAt(0); // 91/123 = JSON 数组/对象的起始字符
    const isJson = /\.json$/i.test(fname || '') || c0 === 91 || c0 === 123;
    return isJson ? parseImportJson(text) : parseImportCsv(text);
  }

  // 归一化 + 去重并入现有数组（纯函数）：整行空白忽略；无语句或语句已存在（忽略空白差异）跳过
  function mergeImport(raws, arr) {
    const ids = new Set(arr.map((x) => x.id));
    const key = (q) => String(q || '').replace(/\s+/g, '').trim();
    const seen = new Set(arr.map((x) => key(x.query)).filter(Boolean));
    const list = arr.slice();
    let added = 0, skipped = 0;
    for (const raw of raws) {
      const it = {};
      for (const f of LIB_FIELDS) it[f.key] = raw[f.key] == null ? '' : String(raw[f.key]).trim();
      it.ts = raw.ts == null ? '' : String(raw.ts).trim();
      it.pin = raw.pin === true;
      if (!LIB_FIELDS.some((f) => f.key !== 'folder' && it[f.key])) continue; // 整行空白（仅文件夹不算内容）
      const k = key(it.query);
      if (!k || seen.has(k)) { skipped++; continue; }
      let id = Number(raw.id);
      if (!raw.id || !Number.isFinite(id) || ids.has(id)) {
        do { id = Date.now() + Math.floor(Math.random() * 1e6); } while (ids.has(id));
      }
      it.id = id;
      ids.add(id);
      seen.add(k);
      list.push(it);
      added++;
    }
    return { list, added, skipped };
  }

  // 读取导入文件：带 BOM 按 UTF-8；无 BOM 时先按 UTF-8 解码，
  // 出现替换符说明是 Excel 另存的 ANSI/GBK 编码 CSV（中文 Windows 默认），改按 GBK 解
  function readImportText(f, cb) {
    const rd = new FileReader();
    rd.onload = () => {
      const buf = new Uint8Array(rd.result);
      let text = new TextDecoder('utf-8').decode(buf);
      if (!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) && text.indexOf('\ufffd') >= 0) {
        try { text = new TextDecoder('gbk').decode(buf); } catch (e) { /* 环境不支持 gbk，保留 utf-8 结果 */ }
      }
      cb(text);
    };
    rd.onerror = () => cb(null);
    rd.readAsArrayBuffer(f);
  }

  function importToast(html) {
    const old = document.getElementById('fofa-imp-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.id = 'fofa-imp-toast';
    t.innerHTML = html;
    t.addEventListener('click', () => t.remove());
    document.documentElement.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 4500);
  }

  function doImport(panel) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,.csv,application/json,text/csv';
    inp.style.display = 'none';
    inp.addEventListener('cancel', () => inp.remove()); // 取消选择框时清理隐藏 input（浏览器不支持则无影响）
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      readImportText(f, (text) => {
        if (text == null) { importToast('⚠️ 导入失败：文件读取错误'); return; }
        try {
          const res = mergeImport(parseImport(text, f.name), loadLib());
          saveLib(res.list);
          if (panel && panel.parentNode) renderLib(panel);
          importToast(`✅ 导入完成：新增 <b>${res.added}</b> 条，跳过 <b>${res.skipped}</b> 条（语句为空或已存在）`);
        } catch (err) {
          importToast('⚠️ 导入失败：' + esc(err.message));
        }
      });
    });
    document.body.appendChild(inp);
    inp.click();
  }

  // 启动时清理“全部字段为空”的条目（修复历史监听器叠加 bug 产生的空行堆积）
  (function purgeEmptyLib() {
    try {
      const arr = JSON.parse(localStorage.getItem(LIB_KEY) || '[]');
      if (!Array.isArray(arr)) return;
      const meaningful = arr.filter((it) => it && LIB_FIELDS.some((f) => f.key !== 'folder' && String(it[f.key] || '').trim() !== ''));
      if (meaningful.length !== arr.length) localStorage.setItem(LIB_KEY, JSON.stringify(meaningful));
    } catch (e) { /* ignore */ }
  })();

  function ensureToolboxBtn() {
    if (document.getElementById('fofa-toolbox-btn')) return;
    const b = document.createElement('div');
    b.id = 'fofa-toolbox-btn';
    b.textContent = '🧰 工具箱';
    b.title = '打开工具箱（Alt+Q）：指纹库 / 查询编辑器';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (document.getElementById('fofa-toolbox-box')) closeToolbox(true); else openToolbox();
    });
    document.documentElement.appendChild(b);
  }
  setInterval(() => { injectStyle(); ensureToolboxBtn(); }, 2000); // SPA 重渲染/注水后补回样式与按钮
  ensureToolboxBtn();

  // 首页（fofa.info 根路径）默认自动打开工具箱（指纹库标签页），居中偏下显示；
  // 用户手动关闭过则本页面会话内不再自动弹出
  setInterval(() => {
    if (boxUserClosed) return;
    const home = location.pathname === '/' || location.pathname === '';
    if (home && !document.getElementById('fofa-toolbox-box')) openToolbox(true);
  }, 1500);

  /* ---------------- 查询编辑器（工具箱第二个标签页） ----------------
     按「字段卡」编辑：同一字段的值集中在一张卡里（country 多国并列、product 一串排除…），
     卡内拼接可选 且(&&) / 或(||)——或卡多值合成时自动加括号；识别不了的片段以「原样」卡保留。
     预设：把某张卡（或整条语句）存为命名预设，需要时一键并入（同字段同拼接的卡自动合并去重）。
     快捷键：Alt+A 新增字段卡；Alt+O 在焦点卡追加值（继承上一行运算符）；回车搜索。 */

  const EDITOR_FIELDS = ['title','host','ip','port','country','region','city','asn','org','domain',
    'protocol','server','product','app','category','icon_hash','header','body','cert','cert.subject.org',
    'cert.subject.cn','after','before','is_cloud','is_domain','is_ipv6','status_code','type','fid','header_hash'];

  // 顶层按 || 切分（跳过引号与括号内的 ||），结构与 splitTop 相同
  function splitOrTop(q) {
    const parts = [];
    let depth = 0, inStr = false, buf = '';
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      if (inStr) { buf += c; if (c === '"') inStr = false; continue; }
      if (c === '"') { inStr = true; buf += c; continue; }
      if (c === '(') { depth++; buf += c; continue; }
      if (c === ')') { depth = depth > 0 ? depth - 1 : 0; buf += c; continue; }
      if (depth === 0 && c === '|' && q[i + 1] === '|') { parts.push(buf.trim()); buf = ''; i++; continue; }
      buf += c;
    }
    parts.push(buf.trim());
    return parts.filter(Boolean);
  }

  // 迭代剥掉所有真正包裹整个表达式的最外层括号（引号里的括号不误判，中途闭合的不剥）
  function stripWrapParens(s) {
    s = String(s).trim();
    while (s.startsWith('(') && s.endsWith(')')) {
      let depth = 0, inStr = false, wraps = true;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (inStr) { if (c === '"') inStr = false; continue; }
        if (c === '"') { inStr = true; continue; }
        if (c === '(') depth++;
        else if (c === ')') { if (depth > 0) depth--; if (depth === 0 && i < s.length - 1) { wraps = false; break; } }
      }
      if (!wraps || depth !== 0) break;
      s = s.slice(1, -1).trim();
    }
    return s;
  }

  // 括号配平：FOFA 生成的语句可能括号不配对（如整段开头多一层 ( 而缺对应的 )，实测样例），
  // 缺的右括号会让顶层 && 永远切不开、整句落成原样卡。缺失的右括号补在末尾
  // （等于把尾部条件并入最外层组，&& 链语义不变）；多余的右括号没有对应左括号，直接丢弃。
  // 引号内的括号不参与计数、也不会被丢弃。
  function balanceParens(q) {
    let out = '', inStr = false, opens = 0;
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      if (inStr) { out += c; if (c === '"') inStr = false; continue; }
      if (c === '"') { inStr = true; out += c; continue; }
      if (c === '(') { opens++; out += c; continue; }
      if (c === ')') { if (opens > 0) { opens--; out += c; } continue; } // 无对应左括号的右括号丢弃
      out += c;
    }
    return out + ')'.repeat(opens);
  }

  // 单个条件 -> 行对象；裸关键词 -> field 为空；识别不了 -> null（由调用方落为原样卡）
  function parseCondOne(s) {
    s = String(s).trim();
    const kw = /^"([^"]*)"$/.exec(s);
    if (kw) return { field: '', op: '', value: kw[1] };
    const m = /^([A-Za-z_][\w.]*)\s*(==|!=|=)\s*([\s\S]*)$/.exec(s);
    if (!m) return null;
    let v = m[3].trim();
    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    return { field: m[1], op: m[2], value: v };
  }

  // 语句 -> 字段卡数组：顶层按 && 分段后，同字段的零散单行并成一张「且」卡（保持首见位置），
  // 纯同字段的或组成为一张「或」卡，跨字段或组等其余片段整段原样保留。
  // 整段被括号包裹的 && 链（如 ((A组) && B && C)）要先剥开包裹再按 && 分段，否则会整段落成原样卡；
  // 括号不配对的语句先经 balanceParens 补全。包裹剥不干净的段（如 (A && B) && C 中的 (A && B)）
  // 识别不了时递归再按 && 切一层
  function parseQueryToCards(q) {
    const cards = [];
    const byField = new Map();
    const addSeg = (seg) => {
      const alts = splitOrTop(stripWrapParens(seg)).filter(Boolean);
      if (!alts.length) return;
      if (alts.length === 1) {
        const row = parseCondOne(alts[0]);
        if (!row) {
          const subs = splitTop(stripWrapParens(seg));
          if (subs.length > 1) { subs.forEach(addSeg); return; } // 括号包裹的 && 链：递归再切
          cards.push({ raw: seg });
          return;
        }
        const slim = { op: row.op, value: row.value };
        if (!row.field) { cards.push({ field: '', join: '&&', rows: [slim] }); return; }
        const key = row.field.toLowerCase();
        const c = byField.get(key);
        if (c) c.rows.push(slim);
        else {
          const card = { field: row.field, join: '&&', rows: [slim] };
          byField.set(key, card);
          cards.push(card);
        }
        return;
      }
      const rows = alts.map((a) => parseCondOne(a));
      if (rows.every((r) => r && r.field && r.field.toLowerCase() === rows[0].field.toLowerCase())) {
        cards.push({ field: rows[0].field, join: '||', rows: rows.map((r) => ({ op: r.op, value: r.value })) });
      } else {
        cards.push({ raw: seg });
      }
    };
    for (const part of splitTop(balanceParens(String(q || '').trim()))) {
      const peeled = stripWrapParens(part);
      const segs = splitTop(peeled);
      segs.forEach((seg) => {
        const n0 = cards.length;
        addSeg(seg);
        // 剥壳后整个 part 就是一张原样卡时，用带括号的原 part：
        // 跨字段或组如 (a="1" || b="2") 的括号承载优先级，丢了会变义
        if (peeled !== part && segs.length === 1 && cards.length === n0 + 1 && cards[n0].raw != null) {
          cards[n0].raw = part;
        }
      });
    }
    return cards;
  }

  function cardRowQ(card, r) {
    if (r.raw != null) return String(r.raw).trim();
    if (!card.field) return r.value ? `"${r.value}"` : '';
    return r.value === '' ? '' : `${card.field}${r.op}"${r.value}"`;
  }

  // 单卡内容（不加外层括号，存预设用）；或卡多值只在整句合成时才加括号
  function cardToQuery(card) {
    if (card.raw != null) return String(card.raw).trim();
    const rows = (card.rows || []).map((r) => cardRowQ(card, r)).filter(Boolean);
    return rows.join(card.join === '||' ? ' || ' : ' && ');
  }

  function cardsToQuery(cards) {
    const parts = [];
    for (const c of cards) {
      if (c.raw != null) { const s = String(c.raw).trim(); if (s) parts.push(s); continue; }
      const rows = (c.rows || []).map((r) => cardRowQ(c, r)).filter(Boolean);
      if (!rows.length) continue;
      if (rows.length > 1 && c.join === '||') parts.push('(' + rows.join(' || ') + ')');
      else parts.push(rows.join(' && '));
    }
    return parts.join(' && ');
  }

  /* 指纹库语句去重瘦身（纯函数，基于字段卡）：
     1) 同字段的且卡里存在包含条件(=/==) -> 只保留最后一条（用户最终定位的条件），
        该字段的全部 != 中间排除一并丢弃（正条件已隐含排除其他值）；
     2) 纯排除卡是有效过滤 -> 保留，仅去掉完全重复的行与值为 - 的无效条件；
     3) product 存在包含条件时，category 卡视为冗余丢弃（FOFA 产品隶属分类）；
     4) 或组卡（多国并列等）、关键词卡、原样片段不动。 */
  function dedupeQuery(q) {
    const cards = parseQueryToCards(q);
    const hasPosProduct = cards.some((c) => c.raw == null
      && c.field.toLowerCase() === 'product'
      && (c.rows || []).some((r) => r.op === '=' || r.op === '=='));
    const out = [];
    for (const c of cards) {
      if (c.raw != null || !c.field || c.join === '||') { out.push(c); continue; }
      if (c.field.toLowerCase() === 'category' && hasPosProduct) continue;
      const positives = (c.rows || []).filter((r) => r.op !== '!=' && r.value !== '-');
      if (positives.length) {
        out.push({ field: c.field, join: c.join, rows: [positives[positives.length - 1]] });
      } else {
        const seen = new Set();
        const rows = [];
        for (const r of c.rows || []) {
          if (r.value === '-') continue;
          const k = r.op + '' + r.value;
          if (seen.has(k)) continue;
          seen.add(k);
          rows.push(r);
        }
        if (rows.length) out.push({ field: c.field, join: c.join, rows });
      }
    }
    return cardsToQuery(out);
  }

  // 删除指定字段的全部条件（纯函数，基于字段卡）：或组整组删、单条/排除行删，原样片段与其他字段不动
  function dropFieldQuery(q, field) {
    const f = String(field).toLowerCase();
    return cardsToQuery(parseQueryToCards(q).filter((c) => c.raw != null || c.field.toLowerCase() !== f));
  }

  // 语句类快速操作集（指纹库「⚡ 快速操作」下拉）：对全库逐条套用纯函数，共用 ↩ 整库撤销
  const LIB_QUICK_OPS = {
    dedup: { label: '全库去重', fn: dedupeQuery },
    dropcountry: { label: '删除地区', fn: (q) => dropFieldQuery(q, 'country') }
  };

  function libApplyQueryOp(pane, fn, label) {
    const arr = loadLib();
    const snap = JSON.parse(JSON.stringify(arr));
    let changed = 0;
    for (const it of arr) {
      if (!it.query) continue;
      const before = String(it.query).trim();
      const q2 = fn(before);
      if (q2 !== before) { it.query = q2; changed++; }
    }
    libUndoSnap = changed ? snap : null;
    saveLib(arr);
    renderLib(pane);
    importToast(changed ? `✅ ${label}完成：<b>${changed}</b> 条语句被修改，失误可点「↩ 撤销」` : `${label}：全库没有可修改的内容`);
  }

  // 预设并入（可单测）：同字段同拼接方式的卡合并行并去重，其余追加为新卡
  function mergeCards(dest, incoming) {
    const out = dest.slice();
    for (const pc of incoming) {
      if (pc.raw != null) { out.push(pc); continue; }
      const tgt = out.find((c) => c.raw == null && c.field.toLowerCase() === pc.field.toLowerCase() && c.join === pc.join);
      if (tgt) {
        for (const r of pc.rows) if (!tgt.rows.some((x) => x.op === r.op && x.value === r.value)) tgt.rows.push({ op: r.op, value: r.value });
      } else out.push(pc);
    }
    return out;
  }

  const PRESET_KEY = 'fofa-toolbox-presets';
  function loadPresets() {
    try { const a = JSON.parse(localStorage.getItem(PRESET_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function savePresets(arr) {
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(arr)); return true; }
    catch (e) { return false; }
  }

  let editMain = null; // 主编辑器实例（工具箱「查询编辑器」标签页；「管理预设」里另有内嵌实例）
  let editorSeq = 0;   // 编辑器实例序号：datalist 等 id 去重用

  /* 语句文本 -> 叶子条件区间扫描（联动定位用）：拆分规则与 parseQueryToCards 完全一致
     （配平括号 -> 顶层 && -> 剥包裹 -> 顶层 && -> 剥包裹 -> 顶层 || -> 剥包裹 -> 叶子），
     但带着原文区间走。每个叶子是一条可解析的单条件（含裸关键词），或一个识别不了的
     原样片段（raw），返回其在原文中的 {start,end}。 */
  function scanLeaves(q) {
    const leaves = [];
    const text = balanceParens(String(q || ''));
    const isWs = (c) => /\s/.test(c);
    const trim = (lo, hi) => { while (lo < hi && isWs(text[lo])) lo++; while (hi > lo && isWs(text[hi - 1])) hi--; return [lo, hi]; };
    // 剥掉整段包裹括号（区间版，与 stripWrapParens 同规则：引号内不算、中途闭合不剥）
    const peel = (lo0, hi0) => {
      let lo = lo0, hi = hi0;
      for (;;) {
        [lo, hi] = trim(lo, hi);
        if (text[lo] !== '(' || text[hi - 1] !== ')') break;
        let depth = 0, inStr = false, wraps = true;
        for (let i = lo; i < hi; i++) {
          const c = text[i];
          if (inStr) { if (c === '"') inStr = false; continue; }
          if (c === '"') { inStr = true; continue; }
          if (c === '(') depth++;
          else if (c === ')') { if (depth > 0) depth--; if (depth === 0 && i < hi - 1) { wraps = false; break; } }
        }
        if (!wraps || depth !== 0) break;
        lo++; hi--;
      }
      return [lo, hi];
    };
    // 顶层按 && / || 切分（区间版，与 splitTop/splitOrTop 同规则，多余的右括号深度钳制在 0）
    const splitAt = (lo0, hi0, sep) => {
      let lo = lo0, hi = hi0;
      [lo, hi] = trim(lo, hi);
      const parts = [];
      let depth = 0, inStr = false, start = lo;
      for (let i = lo; i < hi; i++) {
        const c = text[i];
        if (inStr) { if (c === '"') inStr = false; continue; }
        if (c === '"') { inStr = true; continue; }
        if (c === '(') { depth++; continue; }
        if (c === ')') { if (depth > 0) depth--; continue; }
        if (depth === 0 && c === sep && text[i + 1] === sep) {
          parts.push(trim(start, i));
          i++; start = i + 1;
        }
      }
      parts.push(trim(start, hi));
      return parts.filter((p) => p[0] < p[1]); // 对应 splitTop 的空段过滤
    };
    const pushLeaf = (lo, hi) => {
      const row = parseCondOne(text.slice(lo, hi));
      if (row) leaves.push({ start: lo, end: hi, field: row.field, op: row.op, value: row.value });
      else leaves.push({ start: lo, end: hi, raw: true });
    };
    // 与 parseQueryToCards 的 addSeg 逐步同构：1 alt=单条件或包裹链递归；多 alt=同字段或组或原样。
    // ov 为可选的外层 part 范围（含包裹括号）：叶子可扩到括号上（点击括号也能定位），
    // 原样片段区间与解析器保下的带括号原文一致
    const walkSeg = (lo0, hi0, ov) => {
      const [plo, phi] = peel(lo0, hi0);
      const alts = splitAt(plo, phi, '|');
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
        leaves.pop(); // 单条件解析失败：先按 && 再切一层（包裹链递归），仍失败才落原样
        const subs = splitAt(plo, phi, '&');
        if (subs.length > 1) { subs.forEach((s) => walkSeg(s[0], s[1])); return; }
        leaves.push({ start: tlo, end: thi, raw: true });
        return;
      }
      const rows = alts.map((a) => parseCondOne(text.slice(a[0], a[1])));
      if (rows.every((r) => r && r.field && r.field.toLowerCase() === rows[0].field.toLowerCase())) {
        alts.forEach((a, i) => leaves.push({ start: a[0], end: a[1], field: rows[i].field, op: rows[i].op, value: rows[i].value }));
        const f0 = leaves[leaves.length - alts.length];
        const l0 = leaves[leaves.length - 1];
        f0.start = Math.min(f0.start, tlo); // 只把首项起点、末项终点向外扩到段边界（含括号）
        l0.end = Math.max(l0.end, thi);
      } else {
        leaves.push({ start: tlo, end: thi, raw: true });
      }
    };
    splitAt(0, text.length, '&').forEach((sp) => {
      const [plo, phi] = peel(sp[0], sp[1]);
      const segs = splitAt(plo, phi, '&');
      const [ptlo, pthi] = trim(sp[0], sp[1]);
      const hadWrap = ptlo !== plo || pthi !== phi; // 这个 part 剥过包裹括号
      segs.forEach((t) => {
        const n0 = leaves.length;
        // 单一段时把段范围（含括号）传下去
        walkSeg(t[0], t[1], (hadWrap && segs.length === 1) ? [ptlo, pthi] : null);
        // 与解析器一致：剥壳后整段落成原样片段时，区间用整段（含括号）
        if (hadWrap && segs.length === 1 && leaves.length === n0 + 1 && leaves[n0].raw) {
          leaves[n0].start = ptlo;
          leaves[n0].end = pthi;
        }
      });
    });
    return leaves;
  }

  /* 卡片 <-> 语句文本位置映射：叶子按「同字段文本出现顺序 = 卡内行序」配对（解析器按
     遇到顺序收集同字段行，两侧顺序天然一致），原样片段按出现顺序配对原样卡。
     leafAt(offset)：光标落在哪个条件上 -> {ci,ri}（原样卡 ri 为 -1，空隙返回 null）；
     spanOfCard(ci)：该卡在文本中的区间（卡内各行区间的并集，或原样片段区间）。 */
  function cardTextSpans(cards, q) {
    const leaves = scanLeaves(q);
    const seen = new Map();
    for (const lf of leaves) {
      if (lf.raw) continue;
      const k = (lf.field || '').toLowerCase();
      lf.seq = seen.get(k) || 0;
      seen.set(k, lf.seq + 1);
    }
    const cardSpan = [];
    const rowSeq = new Map();
    let rawIdx = 0;
    const rawLeaves = leaves.filter((l) => l.raw);
    (cards || []).forEach((c, ci) => {
      if (c.raw != null) {
        const lf = rawLeaves[rawIdx++];
        if (lf) { lf.ci = ci; lf.ri = -1; cardSpan[ci] = { start: lf.start, end: lf.end }; }
        return;
      }
      let un = null;
      (c.rows || []).forEach((r, ri) => {
        const k = c.field.toLowerCase();
        const seq = rowSeq.get(k) || 0;
        rowSeq.set(k, seq + 1);
        const lf = leaves.find((l) => !l.raw && (l.field || '').toLowerCase() === k && l.seq === seq);
        if (!lf) return;
        lf.ci = ci; lf.ri = ri;
        un = un ? { start: Math.min(un.start, lf.start), end: Math.max(un.end, lf.end) } : { start: lf.start, end: lf.end };
      });
      if (un) cardSpan[ci] = un;
    });
    return {
      leafAt: (off) => {
        for (const lf of leaves) {
          if (lf.ci !== undefined && lf.start <= off && off < lf.end) return { ci: lf.ci, ri: lf.ri };
        }
        return null;
      },
      spanOfCard: (ci) => cardSpan[ci] || null
    };
  }

  // 编辑器骨架（主编辑器与「管理预设」的内嵌编辑共用；sfx 让 datalist 的 id 不重复）
  function editorShellHtml(sfx, preset) {
    const datalist = `<datalist id="fofa-edit-fields${sfx}">${EDITOR_FIELDS.map((f) => `<option value="${f}"></option>`).join('')}</datalist>`;
    if (preset) return `${datalist}
      <div class="fx-e-cards"></div>
      <div class="fx-e-adds">
        <button class="fx-e-andb" title="新增一张字段卡">＋ 字段卡</button>
        <button class="fx-e-orb" title="在焦点卡追加一个值，继承运算符">＋ 值</button>
      </div>
      <textarea class="fx-e-qtext" spellcheck="false" title="预设搜索串（可直接编辑）：改动实时解析成上方字段卡；卡片侧的改动也实时回写到这里。括号不配对会自动补全" placeholder="预设搜索串（可直接编辑，与上方卡片实时互通）"></textarea>
      <div class="fx-e-pactions">
        <button class="fx-e-psave2" title="把当前内容写回该预设的搜索串">💾 保存到预设</button>
        <button class="fx-e-ccollapse" title="收起编辑（未保存的改动会丢弃）">收起</button>
      </div>`;
    return `${datalist}
      <div class="fx-e-quick">
        <button class="fx-e-qmonth" title="切换 after=一月内条件（再点一次移除，月末钳制）">📅 一个月内</button>
        <button class="fx-e-qcloud" title="切换 is_cloud=&quot;false&quot; 排除云服务（兼容识别 is_cloude 写法；再点一次移除）">☁️ 排除云服务</button>
        <button class="fx-e-reload" title="读入当前页面的查询语句（编辑器已有内容会先询问），之后恢复自动跟随页面语句">↻ 使用当前查询语句</button>
        <button class="fx-e-blank" title="清空编辑器从零组装（已有内容会先询问）；此后不再自动跟随页面语句">📄 新建空白查询</button>
        <button class="fx-e-savefp" title="把当前语句存入指纹库（自动填名称/产品/收录时间）">🗂 存为指纹</button>
        <button class="fx-e-pbtn" title="展开/收起预设快插列表">📦 预设</button>
      </div>
      <div class="fx-e-pbox" style="display:none">
        <div class="fx-e-prow">
          <input class="fx-e-pname" placeholder="预设名称，如：地区-中亚" spellcheck="false">
          <button class="fx-e-psave" title="保存为预设：焦点行存单条条件，焦点卡存整卡，无焦点存整条语句">💾 存为预设</button>
        </div>
        <div class="fx-e-plist"></div>
      </div>
      <div class="fx-e-cards"></div>
      <div class="fx-e-adds">
        <button class="fx-e-andb" title="新增一张字段卡（Alt+A）">＋ 字段卡 Alt+A</button>
        <button class="fx-e-orb" title="在焦点卡追加一个值，继承运算符（Alt+O）">＋ 值 Alt+O</button>
      </div>
      <textarea class="fx-e-qtext" spellcheck="false" title="查询语句（可直接编辑）：改动实时解析成上方字段卡；卡片侧的改动也会实时回写到这里。括号不配对会自动补全。单击语句中的条件可定位上方对应卡片" placeholder="查询语句（可直接编辑，与上方卡片实时互通）——回车搜索，Shift+回车换行"></textarea>
      <div class="fx-e-actions">
        <button class="fx-e-search" title="按当前语句发起查询（编辑器内回车同）">🔍 搜索</button>
        <button class="fx-e-copy" title="复制当前语句">📋 复制</button>
      </div>
      <div class="fx-e-hint">按字段分卡编辑：同字段的值集中在一张卡，卡内选 且(&&)/或(||)，或卡自动加括号 · 语句框可直接编辑并与卡片实时互通（括号自动配平）；单击语句中的条件可定位上方卡片，聚焦卡片会在语句框选中其文本 · 预设可快插/管理 · 回车搜索 · Alt+Q 开关工具箱</div>`;
  }

  /* 查询编辑器工厂：一份完整的卡片编辑器。卡片数组、焦点（卡/行）、上次页面语句、
     「已显式载入」标记、高亮卡全部是实例私有状态——工具箱主编辑器与「管理预设」里
     内嵌的预设编辑互不干扰。 */
  function createEditor(pane, sfx) {
    const st = { cards: [], focus: null, lastParsed: null, loaded: false, hlCi: null };
    const qtext = pane.querySelector('.fx-e-qtext');
    const cardsEl = pane.querySelector('.fx-e-cards');
    const dl = 'fofa-edit-fields' + sfx;

    function renderCards() {
      if (!cardsEl) return;
      if (!st.cards.length) {
        cardsEl.innerHTML = '<div class="fx-e-empty">（无条件）：直接在下方语句框输入，或点上方快速开关 / 预设，或 Alt+A 添加字段卡</div>';
        applyHl(st.hlCi);
        return;
      }
      let html = '';
      st.cards.forEach((c, ci) => {
        if (c.raw != null) {
          html += `<div class="fx-e-group" data-ci="${ci}">
            <div class="fx-e-chead"><span class="fx-e-tag">原样片段</span><span class="fx-e-cops"><b class="fx-e-cdel" title="删除此卡">✕</b></span></div>
            <div class="fx-e-row"><input class="raw" data-ci="${ci}" data-ri="0" data-f="raw" value="${esc(c.raw)}" spellcheck="false"></div>
          </div>`;
          return;
        }
        const or = c.join === '||' && (c.rows || []).length > 1;
        html += `<div class="fx-e-group${or ? ' or' : ''}" data-ci="${ci}">
          <div class="fx-e-chead">
            <input class="fx-e-cfld" list="${dl}" data-ci="${ci}" data-f="field" value="${esc(c.field)}" placeholder="字段（留空=关键词）" spellcheck="false" title="字段名，如 country / product / icon_hash">
            <select class="fx-e-cjoin" data-ci="${ci}" data-f="join" title="卡内多值如何拼接">
              <option value="&&"${c.join === '&&' ? ' selected' : ''}>且 &&</option>
              <option value="||"${c.join === '||' ? ' selected' : ''}>或 ||</option>
            </select>
            <span class="fx-e-tag">${or ? '( 或卡自动加括号 )' : ((c.rows || []).length + ' 值')}</span>
            <span class="fx-e-cops"><b class="fx-e-cadd" title="在本卡追加一个值（Alt+O）">＋值</b><b class="fx-e-cdel" title="删除整卡">✕</b></span>
          </div>`;
        (c.rows || []).forEach((r, ri) => {
          const conn = ri === 0 ? '' : (c.join === '||' ? '<span class="fx-e-or">‖ 或</span>' : '<span class="fx-e-rowand">且 &&</span>');
          html += `<div class="fx-e-row">${conn}
            <select data-ci="${ci}" data-ri="${ri}" data-f="op" title="运算符">
              <option value="="${r.op === '=' ? ' selected' : ''}>模糊 =</option>
              <option value="=="${r.op === '==' ? ' selected' : ''}>精确 ==</option>
              <option value="!="${r.op === '!=' ? ' selected' : ''}>排除 !=</option>
            </select>
            <input class="val" data-ci="${ci}" data-ri="${ri}" data-f="value" value="${esc(r.value)}" spellcheck="false" placeholder="值">
            <b class="fx-e-rdel" data-ci="${ci}" data-ri="${ri}" title="删除此值">✕</b>
          </div>`;
        });
        html += '</div>';
      });
      cardsEl.innerHTML = html;
      applyHl(st.hlCi);
    }

    function updateState(fromText) {
      const q = cardsToQuery(st.cards);
      // 语句框不是本次变更的来源时才回写，避免在语句框里打字的过程中被合成语句覆盖
      if (qtext && !fromText && qtext.value !== q) qtext.value = q;
      const hasField = (name) => st.cards.some((c) => c.raw == null && c.field.toLowerCase() === name);
      const mb = pane.querySelector('.fx-e-qmonth');
      if (mb) mb.classList.toggle('on', hasField('after'));
      const cb = pane.querySelector('.fx-e-qcloud');
      if (cb) cb.classList.toggle('on', hasField('is_cloud') || hasField('is_cloude'));
      const sb = pane.querySelector('.fx-e-search');
      if (sb) { sb.disabled = !q; sb.style.opacity = q ? '' : '.5'; }
    }

    function refresh(fromText) { renderCards(); updateState(fromText); }

    function applyHl(ci) {
      st.hlCi = ci;
      if (!cardsEl) return;
      cardsEl.querySelectorAll('.fx-e-group').forEach((g) => g.classList.toggle('fx-e-hl', ci != null && +g.dataset.ci === ci));
    }

    // 读入页面语句（此后恢复自动跟随：页面语句变了再切回编辑器标签页会自动重读）
    function parseFromPage() {
      st.lastParsed = currentQuery();
      st.loaded = false;
      st.cards = parseQueryToCards(st.lastParsed);
      st.focus = null;
      applyHl(null);
      refresh();
    }

    // 显式载入一条语句（指纹 / 预设覆盖 / 空白查询）：此后不再自动跟随页面语句
    function loadQuery(q) {
      st.cards = parseQueryToCards(q || '');
      st.focus = null;
      st.loaded = true;
      applyHl(null);
      refresh();
    }

    // 预设并入：同字段同拼接方式的卡自动合并行并去重
    function insertPreset(content) {
      st.cards = mergeCards(st.cards, parseQueryToCards(content));
      st.focus = null;
      refresh();
    }

    // 快速开关：再点一次移除；云服务行兼容 is_cloud / is_cloude 两种写法
    function toggleQuick(kind) {
      const isIt = (c) => c.raw == null && (kind === 'month'
        ? c.field.toLowerCase() === 'after'
        : (c.field.toLowerCase() === 'is_cloud' || c.field.toLowerCase() === 'is_cloude'));
      if (st.cards.some(isIt)) st.cards = st.cards.filter((c) => !isIt(c));
      else if (kind === 'month') st.cards.push({ field: 'after', join: '&&', rows: [{ op: '=', value: monthAgoOf(new Date()) }] });
      else st.cards.push({ field: 'is_cloud', join: '&&', rows: [{ op: '=', value: 'false' }] });
      st.focus = null;
      refresh();
    }

    function focusCell(ci, ri, which) {
      const el = pane.querySelector(`[data-ci="${ci}"][data-ri="${ri}"][data-f="${which}"]`);
      if (el) el.focus();
    }

    // 新增字段卡（kind='card'）；在焦点卡追加值（kind='row'，继承焦点行/末行运算符）
    function addItem(kind) {
      if (kind === 'row' && st.cards.length) {
        const fc = st.focus && st.cards[st.focus.ci];
        const ci = fc ? st.focus.ci : st.cards.length - 1;
        const card = st.cards[ci];
        if (card && card.raw == null) {
          const ref = (st.focus && st.focus.ri >= 0 && card.rows[st.focus.ri]) || card.rows[card.rows.length - 1];
          card.rows.push({ op: ref ? ref.op : '=', value: '' });
          refresh();
          focusCell(ci, card.rows.length - 1, 'value');
          return;
        }
      }
      const card = { field: '', join: '&&', rows: [{ op: '=', value: '' }] };
      let ci = st.cards.length;
      if (st.focus && st.cards[st.focus.ci]) ci = st.focus.ci + 1; // 插到焦点卡之后
      st.cards.splice(ci, 0, card);
      refresh();
      const fld = pane.querySelector(`.fx-e-cfld[data-ci="${ci}"]`);
      if (fld) fld.focus();
    }

    /* ---- 共用交互（主编辑器与预设编辑一致） ---- */
    if (qtext) {
      // 语句框手工编辑：实时解析成字段卡（fromText=true 阻止 updateState 回写语句框本身）
      qtext.addEventListener('input', () => {
        st.cards = parseQueryToCards(qtext.value);
        st.focus = null;
        applyHl(null);
        renderCards();
        updateState(true);
      });
      // 失焦时把语句框规范化为合成语句（含括号补全），解析结果肉眼可见
      qtext.addEventListener('blur', () => {
        const q = cardsToQuery(st.cards);
        if (qtext.value !== q) qtext.value = q;
      });
      // 单击语句框：光标落在哪个条件上，就滚动并高亮上方对应卡；该卡/行同时成为焦点
      //（存预设、Alt+O 追加值的目标都跟着光标走）
      qtext.addEventListener('click', () => {
        const m = cardTextSpans(st.cards, qtext.value).leafAt(qtext.selectionStart);
        if (!m) return;
        st.focus = { ci: m.ci, ri: m.ri };
        applyHl(m.ci);
        const g = cardsEl && cardsEl.querySelector(`.fx-e-group[data-ci="${m.ci}"]`);
        if (g) g.scrollIntoView({ block: 'nearest' });
      });
    }

    if (cardsEl) {
      cardsEl.addEventListener('input', (e) => {
        const el = e.target;
        if (!el.dataset || el.dataset.ci === undefined) return;
        const card = st.cards[+el.dataset.ci];
        if (!card) return;
        if (el.dataset.f === 'raw') card.raw = el.value;
        else if (el.dataset.f === 'field') card.field = el.value.trim().toLowerCase();
        else if (el.dataset.f === 'value') {
          const row = card.rows && card.rows[+el.dataset.ri];
          if (row) row.value = el.value;
        }
        updateState();
      });
      cardsEl.addEventListener('change', (e) => {
        const el = e.target;
        if (!el.dataset || el.dataset.ci === undefined) return;
        const card = st.cards[+el.dataset.ci];
        if (!card) return;
        if (el.dataset.f === 'op') {
          const row = card.rows && card.rows[+el.dataset.ri];
          if (row) { row.op = el.value; updateState(); }
        } else if (el.dataset.f === 'join') {
          card.join = el.value;
          refresh(); // 行间连接符与括号高亮随之变化
        }
      });
      // 聚焦卡片：成为焦点卡（存预设/Alt+O 目标），并在语句框里选中该卡的文本
      cardsEl.addEventListener('focusin', (e) => {
        if (!e.target.dataset || e.target.dataset.ci === undefined) return;
        st.focus = { ci: +e.target.dataset.ci, ri: e.target.dataset.ri === undefined ? -1 : +e.target.dataset.ri };
        applyHl(st.focus.ci);
        if (!qtext) return;
        const sp = cardTextSpans(st.cards, qtext.value).spanOfCard(st.focus.ci);
        if (sp) qtext.setSelectionRange(sp.start, sp.end);
      });
      cardsEl.addEventListener('click', (e) => {
        const rd = e.target.closest && e.target.closest('.fx-e-rdel');
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
        const cd = e.target.closest && e.target.closest('.fx-e-cdel');
        if (cd) {
          st.cards.splice(+cd.closest('.fx-e-group').dataset.ci, 1);
          st.focus = null;
          applyHl(null);
          refresh();
          return;
        }
        const ca = e.target.closest && e.target.closest('.fx-e-cadd');
        if (ca) {
          const ci = +ca.closest('.fx-e-group').dataset.ci;
          const card = st.cards[ci];
          if (card && card.raw == null) {
            const ref = card.rows[card.rows.length - 1];
            card.rows.push({ op: ref ? ref.op : '=', value: '' });
            refresh();
            focusCell(ci, card.rows.length - 1, 'value');
          }
        }
      });
      const andb = pane.querySelector('.fx-e-andb');
      const orb = pane.querySelector('.fx-e-orb');
      if (andb) andb.addEventListener('click', () => addItem('card'));
      if (orb) orb.addEventListener('click', () => addItem('row'));
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
      focusInfo: () => (st.focus && st.cards[st.focus.ci] ? { card: st.cards[st.focus.ci], ri: st.focus.ri } : null),
      pageChanged: () => !st.loaded && currentQuery() !== st.lastParsed
    };
  }

  // 主编辑器内联快插列表（列表底部有「管理」入口进管理浮层）
  function renderPresetQuickList(scope) {
    const list = scope && scope.querySelector('.fx-e-plist');
    if (!list) return;
    const arr = loadPresets();
    list.innerHTML = (arr.length ? arr.map((p) => `
      <div class="fx-e-pitem" data-id="${p.id}">
        <span class="fx-e-pn" title="${esc(p.name)}">${esc(p.name)}</span>
        <span class="fx-e-pc" title="点击插入：${esc(p.content)}">${esc(p.content)}</span>
        <b class="fx-e-pins" title="并入编辑器（同字段同拼接的卡自动合并去重）">插入</b>
        <b class="fx-e-pdel" title="删除此预设">✕</b>
      </div>`).join('') : '<div class="fx-e-pempty">暂无预设：输入名称后「💾 存为预设」——保存焦点行（无焦点行时焦点卡 / 整条语句）</div>')
      + '<div class="fx-e-pmgr"><b class="fx-e-pmgrob" title="打开管理预设：新建、编辑、分组、排序、搜索、JSON 导入导出">⚙ 管理预设…</b></div>';
    const btn = scope.querySelector('.fx-e-pbtn');
    if (btn) btn.textContent = `📦 预设 (${arr.length})`;
  }

  function buildEditor(pane) {
    const sfx = 'e' + (++editorSeq);
    pane.innerHTML = editorShellHtml(sfx, false);
    const editor = createEditor(pane, sfx);
    editMain = editor;
    renderPresetQuickList(pane);

    // 预设快插面板：开关 / 保存 / 插入 / 删除（底部「管理」进管理浮层）
    const pbox = pane.querySelector('.fx-e-pbox');
    pane.querySelector('.fx-e-pbtn').addEventListener('click', () => {
      pbox.style.display = pbox.style.display === 'none' ? '' : 'none';
    });
    pane.querySelector('.fx-e-psave').addEventListener('click', () => {
      const f = editor.focusInfo();
      let content, defName = '预设';
      if (f && f.card.raw == null && f.ri >= 0 && f.card.rows[f.ri]) {
        content = cardRowQ(f.card, f.card.rows[f.ri]); // 焦点行：单个条件存成预设
        defName = f.card.field || '关键词';
      } else if (f && f.card.raw == null) {
        content = cardToQuery(f.card);                 // 焦点卡：整卡存成预设
        defName = f.card.field || '关键词';
      } else content = editor.getQuery();              // 无焦点：整条语句
      if (!content) { importToast('⚠️ 没有可保存的内容'); return; }
      const nameEl = pane.querySelector('.fx-e-pname');
      const name = (nameEl.value || '').trim() || defName;
      const arr = loadPresets();
      arr.push({ id: Date.now() + Math.floor(Math.random() * 1e6), name, content, ts: new Date().toLocaleString() });
      if (savePresets(arr)) {
        nameEl.value = '';
        renderPresetQuickList(pane);
        importToast(`✅ 已存预设「<b>${esc(name)}</b>」`);
      }
    });
    pane.querySelector('.fx-e-plist').addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('.fx-e-pmgrob')) { openPresetMgr(); return; }
      const item = e.target.closest && e.target.closest('.fx-e-pitem');
      if (!item) return;
      const p = loadPresets().find((x) => String(x.id) === item.dataset.id);
      if (!p) return;
      if (e.target.closest('.fx-e-pdel')) {
        savePresets(loadPresets().filter((x) => String(x.id) !== item.dataset.id));
        renderPresetQuickList(pane);
        return;
      }
      if (e.target.closest('.fx-e-pins') || e.target.closest('.fx-e-pc')) editor.insertPreset(p.content);
    });

    pane.querySelector('.fx-e-qmonth').addEventListener('click', () => editor.toggleQuick('month'));
    pane.querySelector('.fx-e-qcloud').addEventListener('click', () => editor.toggleQuick('cloud'));
    // 使用当前查询语句：显式拉取页面语句（已有内容先确认），之后恢复自动跟随
    pane.querySelector('.fx-e-reload').addEventListener('click', () => {
      const q = currentQuery();
      if (!q) { importToast('⚠️ 当前页面没有查询语句（先在 FOFA 发起一次搜索）'); return; }
      if (editor.getQuery() && !window.confirm('编辑器里已有内容，用当前页面语句覆盖？')) return;
      editor.parseFromPage();
      importToast('↻ 已载入页面语句');
    });
    // 新建空白查询：从零组装，此后不再自动跟随页面语句
    pane.querySelector('.fx-e-blank').addEventListener('click', () => {
      if (editor.getQuery() && !window.confirm('编辑器里已有内容，清空并新建空白查询？')) return;
      editor.loadQuery('');
      importToast('📄 已新建空白查询');
    });
    // 存为指纹：当前语句直接进指纹库（自动填名称/产品/收录时间）
    pane.querySelector('.fx-e-savefp').addEventListener('click', () => {
      const q = editor.getQuery();
      if (!q) { importToast('⚠️ 当前没有可保存的语句'); return; }
      const prod = productFromQuery(q);
      const arr = loadLib();
      arr.unshift({ id: Date.now(), name: pickName(prod, []), query: q, ip: '', product: prod, category: '', region: '', server: '', title: '', after: fmtDate(new Date()), vendor: '', model: '', note: '', folder: '', ts: new Date().toLocaleString() });
      saveLib(arr);
      const libPane = document.querySelector('#fofa-toolbox-box .fx-t-pane-lib');
      if (libPane) renderLib(libPane);
      importToast('✅ 已存入指纹库（可切到「指纹库」标签页补充信息）');
    });
    pane.querySelector('.fx-e-search').addEventListener('click', () => {
      const q = editor.getQuery();
      if (q) openTab(q);
    });
    pane.querySelector('.fx-e-copy').addEventListener('click', (ev) => {
      const q = editor.getQuery();
      if (q) copyText(q, ev.currentTarget);
    });
    // 编辑器内回车直接搜索
    pane.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.shiftKey && !e.isComposing) {
        const q = editor.getQuery();
        if (q) { e.preventDefault(); openTab(q); }
      }
    });
  }

  /* ---------------- 管理预设（独立浮层） ----------------
     名称/搜索串/分组（文件夹，一层）都可编辑；搜索串用一份内嵌的卡片编辑器改，
     跟查询编辑器一样好操作；支持拖动排序（组内）、搜索过滤、JSON 导出导入；
     「插入」并入主编辑器（同字段同拼接自动合并去重），「覆盖」整条替换主编辑器内容。
     浮层已加入「点击外部关工具箱」的豁免列表，点浮层不会连带关掉工具箱。 */
  function closePresetMgr() {
    const el = document.getElementById('fofa-preset-mgr');
    if (el) el.remove();
  }

  // 文件夹视图判定（纯函数，指纹库/知识库共用）：view 为 '' = 全部、'*' = 未归档、其他 = 指定文件夹名
  function inFolderView(it, view) {
    if (view === '*') return !String(it.folder || '').trim();
    if (view) return String(it.folder || '').trim() === String(view);
    return true;
  }

  /* 批量选择 + 批量移动（指纹库/知识库共用）：进入选择模式后表格首列（原拖动手柄处）
     变为复选框，文件夹条下方出现选择条。搜索框 / 文件夹视图先过滤、再全选、再移动，
     即可按条件批量归档。选择状态只存在于 DOM 复选框里，重渲染自然清空 */
  function updateSelBar(pane) {
    const bar = pane.querySelector('.fx-l-selbar');
    if (!bar) return;
    const on = pane.dataset.selecting === '1';
    bar.style.display = on ? '' : 'none';
    if (on) bar.innerHTML = `
      <span class="fx-l-selcnt">已选 <b>${pane.querySelectorAll('td.fx-l-sel input:checked').length}</b> 项</span>
      <button class="fx-l-selmove" title="把选中的条目移动到指定文件夹（输入名字=移动到该文件夹；清空=移出文件夹）">📁 移动到文件夹…</button>
      <button class="fx-l-selall" title="选中 / 取消当前视图里显示的全部条目">☑ 全选</button>
      <button class="fx-l-selexit" title="退出批量选择">✕ 退出</button>`;
  }

  function updateSelBarCnt(pane) {
    const b = pane.querySelector('.fx-l-selcnt b');
    if (b) b.textContent = String(pane.querySelectorAll('td.fx-l-sel input:checked').length);
  }

  // 批量移动到文件夹：把勾选的条目统一改 folder（load/save/render 由两个库各自传入）
  function batchMoveSelected(pane, load, save, render) {
    const boxes = Array.from(pane.querySelectorAll('td.fx-l-sel input:checked'));
    if (!boxes.length) { importToast('⚠️ 还没有选中任何条目'); return; }
    const curView = pane.dataset.folder || '';
    const pre = (curView && curView !== '*') ? curView : '';
    const name = window.prompt(`把选中的 ${boxes.length} 项移动到哪个文件夹？（输入名字=移动到该文件夹；清空=移出文件夹）`, pre);
    if (name === null) return; // 取消
    const fo = name.trim();
    const arr = load();
    let n = 0;
    for (const b of boxes) {
      const it = arr.find((x) => String(x.id) === b.closest('tr').dataset.id);
      if (it && String(it.folder || '').trim() !== fo) { it.folder = fo; n++; }
    }
    if (n) save(arr);
    delete pane.dataset.selecting;
    render(pane);
    importToast(fo ? `📁 已把 <b>${n}</b> 项移动到「${esc(fo)}」` : `📁 已把 <b>${n}</b> 项移出文件夹`);
  }

  // 通用一层分组（指纹库文件夹 / 预设分组共用）：空组排最后，其余按中文排序，组内保持原顺序
  function groupList(list, keyFn) {
    const map = new Map();
    for (const it of list) { const k = keyFn(it) || ''; if (!map.has(k)) map.set(k, []); map.get(k).push(it); }
    return [...map.entries()]
      .sort((a, b) => (a[0] === '' ? 1 : 0) - (b[0] === '' ? 1 : 0) || a[0].localeCompare(b[0], 'zh'))
      .map(([group, items]) => ({ group, items }));
  }

  // 预设导入合并（纯函数）：名称+搜索串相同视为重复跳过；整条为空不计；id 冲突重分配
  function mergePresets(raws, arr) {
    const ids = new Set(arr.map((x) => x.id));
    const key = (p) => String(p.name || '').trim() + '\u0000' + String(p.content || '').replace(/\s+/g, ' ').trim();
    const seen = new Set(arr.map(key));
    const list = arr.slice();
    let added = 0, skipped = 0;
    for (const raw of raws) {
      if (!raw || typeof raw !== 'object') continue;
      const it = {
        name: String(raw.name == null ? '' : raw.name).trim(),
        content: String(raw.content == null ? '' : raw.content).trim(),
        group: String(raw.group == null ? '' : raw.group).trim(),
        ts: String(raw.ts == null ? '' : raw.ts)
      };
      if (!it.name && !it.content) { skipped++; continue; }
      if (seen.has(key(it))) { skipped++; continue; }
      let id = Number(raw.id);
      if (!raw.id || !Number.isFinite(id) || ids.has(id)) {
        do { id = Date.now() + Math.floor(Math.random() * 1e6); } while (ids.has(id));
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
    const kw = String(filter || '').trim().toLowerCase();
    const hit = (p) => !kw || [p.name, p.content, p.group].some((v) => String(v || '').toLowerCase().includes(kw));
    return loadPresets().filter(hit);
  }

  function renderPresetMgr() {
    const el = document.getElementById('fofa-preset-mgr');
    if (!el) return;
    const all = loadPresets();
    const list = presetMgrFiltered(el.dataset.filter);
    const groups = groupList(list, (p) => p.group);
    const editingId = el.dataset.editing || '';
    const showHeads = groups.length > 1 || groups.some((g) => g.group);
    const NC = 5; // ⠿ + 名称 + 搜索串 + 分组 + 操作
    let rows = '';
    for (const g of groups) {
      if (showHeads) rows += `<tr class="fx-l-ghead"><td colspan="${NC}">📁 ${esc(g.group || '未分组')}<span>${g.items.length}</span></td></tr>`;
      for (const p of g.items) {
        rows += `<tr data-id="${p.id}"><td class="fx-rowdrag" draggable="true" title="拖动调整顺序（同组内）">⠿</td>
          <td data-f="name" contenteditable="true" spellcheck="false">${esc(p.name || '')}</td>
          <td class="fx-l-mono fx-m-pcontent">${esc(p.content || '')}</td>
          <td data-f="group" contenteditable="true" spellcheck="false" title="分组（文件夹，一层；留空=未分组）">${esc(p.group || '')}</td>
          <td class="fx-l-ops"><b class="fx-m-pins" title="并入查询编辑器：同字段同拼接的卡自动合并去重">插入</b><b class="fx-m-povr" title="用此预设整条替换查询编辑器内容">覆盖</b><b class="fx-m-pedit" title="展开卡片编辑器修改搜索串">✏️ 编辑</b><b class="fx-m-pdel" title="删除此预设">✕</b></td></tr>`;
        if (editingId && String(p.id) === editingId) rows += `<tr class="fx-m-peditor"><td colspan="${NC}"></td></tr>`;
      }
    }
    el.querySelector('.fx-m-tablewrap').innerHTML = `<table class="fx-l-table">
      <thead><tr><th style="width:26px"></th><th style="width:130px">名称</th><th>搜索串</th><th style="width:90px">分组</th><th style="width:210px">操作</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="${NC}" class="fx-l-empty">暂无预设：点「＋ 新建」，或到查询编辑器里「💾 存为预设」</td></tr>`}</tbody>
    </table>`;
    const cnt = el.querySelector('.fx-l-count');
    if (cnt) cnt.textContent = String(el.dataset.filter || '').trim() ? `共 ${all.length} 条，匹配 ${list.length} 条` : `共 ${all.length} 条`;
    if (editingId) mountPresetEditor(el.querySelector('.fx-m-peditor td'), all.find((p) => String(p.id) === editingId));
  }

  // 行内展开的预设编辑器：与主编辑器同一工厂、独立状态；保存写回该预设的搜索串
  function mountPresetEditor(cell, preset) {
    if (!cell || !preset) return;
    const sfx = 'p' + (++editorSeq);
    cell.innerHTML = editorShellHtml(sfx, true);
    const ed = createEditor(cell, sfx);
    ed.loadQuery(preset.content || '');
    cell.querySelector('.fx-e-psave2').addEventListener('click', () => {
      const q = ed.getQuery();
      if (!q) { importToast('⚠️ 预设内容为空（要删除请回列表点 ✕）'); return; }
      const arr = loadPresets();
      const it = arr.find((x) => String(x.id) === String(preset.id));
      if (it) { it.content = q; savePresets(arr); }
      const mgr = document.getElementById('fofa-preset-mgr');
      if (mgr) mgr.dataset.editing = '';
      renderPresetMgr();
      if (editMain) renderPresetQuickList(editMain.pane);
      importToast('✅ 预设搜索串已保存');
    });
    cell.querySelector('.fx-e-ccollapse').addEventListener('click', () => {
      const mgr = document.getElementById('fofa-preset-mgr');
      if (mgr) mgr.dataset.editing = '';
      renderPresetMgr();
    });
  }

  function presetImport() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.style.display = 'none';
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      readImportText(f, (text) => {
        if (text == null) { importToast('⚠️ 导入失败：文件读取错误'); return; }
        let raws;
        try { raws = JSON.parse(String(text).replace(/^\ufeff/, '')); }
        catch (err) { importToast('⚠️ 导入失败：JSON 解析失败'); return; }
        if (!Array.isArray(raws)) { importToast('⚠️ 导入失败：JSON 内容不是预设数组'); return; }
        const res = mergePresets(raws, loadPresets());
        savePresets(res.list);
        renderPresetMgr();
        if (editMain) renderPresetQuickList(editMain.pane);
        importToast(`✅ 预设导入：新增 <b>${res.added}</b> 条，跳过 <b>${res.skipped}</b> 条（名称+搜索串重复或整条为空）`);
      });
    });
    document.body.appendChild(inp);
    inp.click();
  }

  function openPresetMgr() {
    closePresetMgr();
    injectStyle();
    const el = document.createElement('div');
    el.id = 'fofa-preset-mgr';
    el.dataset.filter = '';
    el.innerHTML = `
      <div class="fx-m-head">
        <span class="fx-m-title">📦 管理预设</span>
        <input class="fx-m-search" placeholder="搜索：名称 / 搜索串 / 分组" spellcheck="false">
        <span class="fx-l-hbtns"><button class="fx-m-close" title="关闭（Esc）">关闭</button></span>
      </div>
      <div class="fx-m-tools">
        <span class="fx-l-count"></span>
        <button class="fx-m-add" title="新建预设：自动展开卡片编辑器，写好点「💾 保存到预设」">＋ 新建</button>
        <button class="fx-m-expj" title="导出为 JSON 文件">导出 JSON</button>
        <button class="fx-m-impj" title="从 JSON 文件导入（按 名称+搜索串 去重合并）">导入</button>
      </div>
      <div class="fx-m-tablewrap"></div>
      <div class="fx-l-foot">插入=并入查询编辑器（同字段同拼接自动合并去重） · 覆盖=整条替换编辑器内容 · ✏️ 编辑=卡片编辑器改搜索串 · 单元格点击即编辑 · 拖 ⠿ 组内排序</div>`;
    el.querySelector('.fx-m-close').addEventListener('click', closePresetMgr);
    el.querySelector('.fx-m-search').addEventListener('input', (e) => {
      el.dataset.filter = e.target.value;
      renderPresetMgr();
    });
    el.querySelector('.fx-m-add').addEventListener('click', () => {
      const arr = loadPresets();
      const it = { id: Date.now() + Math.floor(Math.random() * 1e6), name: '新预设', content: '', group: '', ts: new Date().toLocaleString() };
      arr.push(it);
      savePresets(arr);
      el.dataset.editing = String(it.id);
      renderPresetMgr();
      const nameCell = el.querySelector(`tbody tr[data-id="${it.id}"] td[data-f="name"]`);
      if (nameCell) nameCell.focus();
    });
    el.querySelector('.fx-m-expj').addEventListener('click', () => {
      downloadFile('fofa-toolbox-presets.json', JSON.stringify(loadPresets(), null, 2), 'application/json');
    });
    el.querySelector('.fx-m-impj').addEventListener('click', presetImport);
    // 名称/分组单元格编辑（focusout 委托；分组变了重排分组）
    el.addEventListener('focusout', (e) => {
      const td = e.target.closest && e.target.closest('td[contenteditable][data-f]');
      if (!td) return;
      const tr = td.closest('tr');
      if (!tr || tr.dataset.id === undefined) return;
      const arr = loadPresets();
      const it = arr.find((x) => String(x.id) === tr.dataset.id);
      if (!it) return;
      it[td.dataset.f] = td.innerText.replace(/\u00a0/g, ' ').trim();
      savePresets(arr);
      if (td.dataset.f === 'group') renderPresetMgr();
      if (editMain) renderPresetQuickList(editMain.pane);
    });
    attachRowDrag(el,
      (a, b) => {
        const arr = loadPresets();
        const A = arr.find((x) => String(x.id) === a);
        const B = arr.find((x) => String(x.id) === b);
        return !!(A && B && String(A.group || '') === String(B.group || ''));
      },
      (id, targetId, before) => {
        const arr = loadPresets();
        const drag = arr.find((x) => String(x.id) === id);
        if (!drag) { renderPresetMgr(); return; }
        arr.splice(arr.indexOf(drag), 1);
        const ti = arr.findIndex((x) => String(x.id) === targetId);
        if (ti < 0) { renderPresetMgr(); return; }
        arr.splice(before ? ti : ti + 1, 0, drag);
        savePresets(arr);
        renderPresetMgr();
      });
    el.addEventListener('click', (e) => {
      const hit = (cls) => e.target.closest && e.target.closest(cls);
      const row = hit('.fx-m-pins,.fx-m-povr,.fx-m-pedit,.fx-m-pdel');
      if (!row) return;
      const id = row.closest('tr').dataset.id;
      if (id === undefined) return;
      const p = loadPresets().find((x) => String(x.id) === id);
      if (!p) return;
      if (hit('.fx-m-pdel')) {
        savePresets(loadPresets().filter((x) => String(x.id) !== id));
        renderPresetMgr();
        if (editMain) renderPresetQuickList(editMain.pane);
        return;
      }
      if (hit('.fx-m-pedit')) {
        el.dataset.editing = el.dataset.editing === id ? '' : id;
        renderPresetMgr();
        return;
      }
      // 插入/覆盖目标主编辑器：工具箱没开就先打开（并切到编辑器标签页）
      if (!document.getElementById('fofa-toolbox-box')) openToolbox(false, 'edit');
      if (!editMain) return;
      if (hit('.fx-m-pins')) {
        editMain.insertPreset(p.content);
        importToast('✅ 已并入查询编辑器（同字段同拼接自动合并去重）');
        return;
      }
      if (editMain.getQuery() && !window.confirm('编辑器里已有内容，用该预设整条覆盖？')) return;
      editMain.loadQuery(p.content);
      importToast(`✅ 已用预设「<b>${esc(p.name)}</b>」覆盖编辑器内容`);
    });
    document.documentElement.appendChild(el);
    renderPresetMgr();
  }

  /* ---------------- 知识库（工具箱第三个标签页） ----------------
     记录厂商贴牌关系（母厂 -> 贴牌厂商/产品）与各产品的 Server/Title，
     支持粘贴/选择产品前端截图（压到 640px 宽的白底 JPEG 存 dataURL，控制 localStorage 体积）。
     表格按「母厂」排序自然形成贴牌分组，顶部搜索框按 母厂/名称/Server/Title/备注 过滤。 */

  const KB_KEY = 'fofa-toolbox-kb';
  const KB_FIELDS = [
    { key: 'parent', label: '母厂/贴牌自', w: '90px' },
    { key: 'name', label: '名称', w: '110px' },
    { key: 'server', label: 'Server', w: '100px', mono: true },
    { key: 'title', label: 'Title', w: '160px' },
    { key: 'note', label: '备注', w: '110px' },
    { key: 'folder', label: '文件夹', w: '70px' }
  ];

  function loadKb() {
    try { const a = JSON.parse(localStorage.getItem(KB_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function saveKb(arr) {
    try { localStorage.setItem(KB_KEY, JSON.stringify(arr)); return true; }
    catch (e) {
      importToast('⚠️ 保存失败：浏览器本地存储空间不足（截图较多时请删除部分图片，或先导出备份再清理）');
      return false;
    }
  }

  // 归一化一条知识库记录（纯函数）：字段转字符串、图片只保留 data:image/ 前缀、
  // order 为可选数字（同母厂组内的手动排序值，导入时保留）、folder 为可选文件夹（一层）；
  // 整条为空返回 null（仅填文件夹不算内容）
  function kbNormEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const it = {
      parent: String(raw.parent == null ? '' : raw.parent).trim(),
      name: String(raw.name == null ? '' : raw.name).trim(),
      server: String(raw.server == null ? '' : raw.server).trim(),
      title: String(raw.title == null ? '' : raw.title).trim(),
      note: String(raw.note == null ? '' : raw.note),
      folder: String(raw.folder == null ? '' : raw.folder).trim(),
      images: Array.isArray(raw.images) ? raw.images.filter((s) => typeof s === 'string' && s.indexOf('data:image/') === 0) : [],
      ts: raw.ts == null ? '' : String(raw.ts)
    };
    if (typeof raw.order === 'number' && Number.isFinite(raw.order)) it.order = raw.order;
    if (!it.parent && !it.name && !it.server && !it.title && !it.note && !it.images.length) return null;
    return it;
  }

  // 新建一条：结果页上自动预填 名称（语句里的 app=/product=）、Server/Title（侧栏排名第一）
  function newKbEntry() {
    const q = currentQuery() || '';
    return {
      id: Date.now(),
      parent: '',
      name: productFromQuery(q),
      server: (grabRankingEntries('Server')[0] || {}).name || '',
      title: (grabRankingEntries('网站标题')[0] || {}).name || '',
      note: '', images: [],
      ts: new Date().toLocaleString()
    };
  }

  function kbFiltered(filter, folderView) {
    const kw = String(filter || '').trim().toLowerCase();
    const hit = (it) => inFolderView(it, folderView)
      && (!kw || [it.parent, it.name, it.server, it.title, it.note, it.folder]
        .some((v) => String(v || '').toLowerCase().includes(kw)));
    // 母厂分组在前；组内先按手动 order（无则 0），再按名称兜底
    return loadKb().filter(hit)
      .sort((a, b) => String(a.parent || '').localeCompare(String(b.parent || ''), 'zh')
        || (a.order || 0) - (b.order || 0)
        || String(a.name || '').localeCompare(String(b.name || ''), 'zh'));
  }

  function renderKb(pane) {
    const wrap = pane.querySelector('.fx-k-wrap');
    if (!wrap) return;
    const arr = loadKb();
    const view = pane.dataset.folder || ''; // ''=全部 '*'=未归档 其他=文件夹名
    // 文件夹筛选条（与指纹库一致）
    const folders = new Map();
    for (const it of arr) {
      const f = String(it.folder || '').trim();
      if (f) folders.set(f, (folders.get(f) || 0) + 1);
    }
    const unfiled = arr.filter((it) => !String(it.folder || '').trim()).length;
    const chip = (fo, label, on) => `<button class="fx-l-fchip${on ? ' on' : ''}" data-fo="${esc(fo)}">${esc(label)}</button>`;
    const fbar = pane.querySelector('.fx-k-folders');
    if (fbar) {
      fbar.innerHTML = chip('', `全部 (${arr.length})`, view === '')
        + chip('*', `未归档 (${unfiled})`, view === '*')
        + [...folders.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh'))
          .map(([f, n]) => chip(f, `📁 ${f} (${n})`, view === f)).join('');
      fbar.style.display = (folders.size || view === '*') ? '' : 'none';
    }
    const kw = String(pane.dataset.filter || '').trim();
    const list = kbFiltered(pane.dataset.filter || '', view);
    const cols = KB_FIELDS.filter((f) => f.key !== 'folder'); // 文件夹是导航不是列
    const selecting = pane.dataset.selecting === '1'; // 批量选择模式：首列手柄换成复选框
    const rows = list.map((it) => `<tr data-id="${it.id}">${selecting
      ? `<td class="fx-l-sel"><input type="checkbox" title="选中以批量移动"></td>`
      : `<td class="fx-rowdrag" draggable="true" title="拖动调整顺序（仅在同一母厂组内）">⠿</td>`}${cols.map((f) =>
      `<td${f.mono ? ' class="fx-l-mono"' : ''} data-f="${f.key}" contenteditable="true" spellcheck="false">${esc(it[f.key] || '')}</td>`
    ).join('')}
      <td class="fx-k-imgs" tabindex="0" title="点击聚焦后 Ctrl+V 粘贴产品截图">${(it.images || []).map((src, i) =>
        `<span class="fx-k-thumbwrap"><img class="fx-k-thumb" data-i="${i}" src="${src}" title="点击放大"><b class="fx-k-imgdel" data-i="${i}" title="删除此图">✕</b></span>`
      ).join('')}<b class="fx-k-addimg" title="选择图片文件">📎</b>${(it.images || []).length ? '' : '<span class="fx-k-hint">点击后 Ctrl+V 粘贴</span>'}</td>
      <td class="fx-l-ops"><b class="fx-l-filebtn" title="归档到文件夹：输入名字归档/移动，清空则移出文件夹">📁</b><b class="fx-k-del" title="删除此条">✕</b></td></tr>`).join('');
    const cnt = pane.querySelector('.fx-l-count');
    if (cnt) cnt.textContent = kw ? `共 ${arr.length} 条，匹配 ${list.length} 条` : `共 ${arr.length} 条`;
    wrap.innerHTML = `<table class="fx-l-table">
      <thead><tr><th style="width:26px"></th>${cols.map((f) => `<th style="width:${f.w}">${f.label}</th>`).join('')}<th>产品截图</th><th>操作</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="${cols.length + 3}" class="fx-l-empty">${kw ? '没有匹配的记录：换个关键词，或清空搜索框' : (view ? '此视图暂无记录：在其他视图用行内 📁 归档进来' : '暂无记录：点「＋ 新建」，在结果页会自动预填 Server/Title；截图列点击后 Ctrl+V 粘贴产品前端')}</td></tr>`}</tbody>
    </table>`;
    updateSelBar(pane);
  }

  // 截图压缩：最长边 640、白底 JPEG（约几十 KB/张），避免撑爆 localStorage
  function kbBlobToDataUrl(blob, cb) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const MAXW = 640;
      const scale = Math.min(1, MAXW / (img.naturalWidth || MAXW));
      const w = Math.max(1, Math.round((img.naturalWidth || MAXW) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || 360) * scale));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cb(cv.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }

  function kbAddImage(pane, id, blob) {
    kbBlobToDataUrl(blob, (data) => {
      if (!data) { importToast('⚠️ 截图读取失败：不是有效的图片'); return; }
      const arr = loadKb();
      const it = arr.find((x) => String(x.id) === String(id));
      if (!it) return;
      it.images = it.images || [];
      it.images.push(data);
      if (saveKb(arr)) renderKb(pane);
    });
  }

  // 点击缩略图全屏查看（点击任意处关闭；Esc 关灯箱优先于关工具箱）
  function kbLightbox(src) {
    const old = document.getElementById('fofa-kb-lightbox');
    if (old) { old.remove(); return; }
    const lb = document.createElement('div');
    lb.id = 'fofa-kb-lightbox';
    const im = document.createElement('img');
    im.src = src;
    lb.appendChild(im);
    lb.addEventListener('click', () => lb.remove());
    document.documentElement.appendChild(lb);
  }

  function kbImport(pane) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.style.display = 'none';
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      readImportText(f, (text) => {
        if (text == null) { importToast('⚠️ 导入失败：文件读取错误'); return; }
        let raws;
        try { raws = JSON.parse(String(text).replace(/^\ufeff/, '')); }
        catch (err) { importToast('⚠️ 导入失败：JSON 解析失败（' + esc(err.message) + '）'); return; }
        if (!Array.isArray(raws)) { importToast('⚠️ 导入失败：JSON 内容不是知识库数组'); return; }
        const arr = loadKb();
        const ids = new Set(arr.map((x) => x.id));
        const keyOf = (it) => [it.parent, it.name, it.server, it.title].join(' | ');
        const seen = new Set(arr.map(keyOf));
        let added = 0, skipped = 0;
        for (const raw of raws) {
          const it = kbNormEntry(raw);
          if (!it) continue;
          const k = keyOf(it);
          if (seen.has(k)) { skipped++; continue; }
          seen.add(k);
          let id = Number(raw.id);
          if (!raw.id || !Number.isFinite(id) || ids.has(id)) {
            do { id = Date.now() + Math.floor(Math.random() * 1e6); } while (ids.has(id));
          }
          it.id = id;
          ids.add(id);
          arr.push(it);
          added++;
        }
        if (added) saveKb(arr);
        if (pane && pane.isConnected) renderKb(pane);
        importToast(`✅ 知识库导入：新增 <b>${added}</b> 条，跳过 <b>${skipped}</b> 条（重复）`);
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
        <button class="fx-k-add" title="新建记录：结果页会自动预填 名称/Server/Title；在某个文件夹视图里新建会自动归档进该文件夹">＋ 新建</button>
        <button class="fx-l-quickbtn" title="批量操作：批量移动到文件夹等">⚡ 快速操作</button>
        <button class="fx-k-expj" title="导出为 JSON 文件（含截图）">导出 JSON</button>
        <button class="fx-k-impj" title="从 JSON 文件导入（按 母厂+名称+Server+Title 去重合并）">导入</button>
      </div>
      <div class="fx-l-quickbox" style="display:none">
        <button data-sop="move" title="进入批量选择：勾选记录后统一移动到某个文件夹（搜索 / 文件夹视图可先过滤再全选，实现按条件批量归档）">📦 批量移动</button>
      </div>
      <div class="fx-k-folders"></div>
      <div class="fx-l-selbar" style="display:none"></div>
      <div class="fx-l-tablewrap fx-k-wrap"></div>
      <div class="fx-l-foot">顶部文件夹条切换视图（全部 / 未归档 / 各文件夹）· 行内 📁 归档/移动 · 按「母厂/贴牌自」排序自然形成贴牌分组 · 搜「大华」即列出其下所有贴牌产品 · 截图列点击聚焦后 Ctrl+V 粘贴（自动压缩存储）· 数据保存在浏览器本地</div>`;
    renderKb(pane);

    // 单元格编辑保存（focusout 委托，与指纹库一致）
    pane.addEventListener('focusout', (e) => {
      const td = e.target.closest && e.target.closest('td[contenteditable][data-f]');
      if (!td) return;
      const arr = loadKb();
      const it = arr.find((x) => String(x.id) === td.closest('tr').dataset.id);
      if (!it) return;
      it[td.dataset.f] = td.innerText.replace(/\u00a0/g, ' ').trim();
      saveKb(arr);
    });

    // 搜索过滤（只重绘表格，输入框不动）
    pane.querySelector('.fx-k-search').addEventListener('input', (e) => {
      pane.dataset.filter = e.target.value;
      renderKb(pane);
    });

    // 文件夹筛选条：切换视图（全部 / 未归档 / 各文件夹）
    pane.addEventListener('click', (e) => {
      const fc = e.target.closest && e.target.closest('.fx-l-fchip');
      if (!fc) return;
      pane.dataset.folder = fc.dataset.fo || '';
      renderKb(pane);
    });

    // ⚡ 快速操作：下拉开关 / 批量移动进入选择模式 / 选择条按钮 / 复选框计数
    pane.addEventListener('click', (e) => {
      if (e.target.closest('.fx-l-quickbtn')) {
        const qb = pane.querySelector('.fx-l-quickbox');
        if (qb) qb.style.display = qb.style.display === 'none' ? '' : 'none';
        return;
      }
      if (e.target.closest && e.target.closest('.fx-l-quickbox button[data-sop="move"]')) {
        const qb = pane.querySelector('.fx-l-quickbox');
        if (qb) qb.style.display = 'none';
        pane.dataset.selecting = '1';
        renderKb(pane);
        importToast('☑ 已进入批量选择：勾选记录后点「📁 移动到文件夹…」（搜索 / 文件夹视图可先过滤再全选）');
        return;
      }
      if (e.target.closest('.fx-l-selexit')) { delete pane.dataset.selecting; renderKb(pane); return; }
      if (e.target.closest('.fx-l-selall')) {
        const boxes = Array.from(pane.querySelectorAll('td.fx-l-sel input'));
        const all = boxes.length && boxes.every((b) => b.checked);
        boxes.forEach((b) => { b.checked = !all; });
        updateSelBarCnt(pane);
        return;
      }
      if (e.target.closest('.fx-l-selmove')) { batchMoveSelected(pane, loadKb, saveKb, renderKb); return; }
    });
    pane.addEventListener('change', (e) => {
      if (e.target.closest && e.target.closest('td.fx-l-sel input')) updateSelBarCnt(pane);
    });

    // 粘贴截图：点击截图列（tabindex 聚焦）后 Ctrl+V
    pane.addEventListener('paste', (e) => {
      const cell = e.target.closest && e.target.closest('.fx-k-imgs');
      if (!cell) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      let got = false;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.type && it.type.indexOf('image/') === 0) {
          const blob = it.getAsFile();
          if (blob) { got = true; kbAddImage(pane, cell.closest('tr').dataset.id, blob); }
        }
      }
      if (got) e.preventDefault();
    });

    // 拖动排序：仅同一母厂组内；组内先归一 order 再按落点插入
    attachRowDrag(pane,
      (a, b) => {
        const arr = loadKb();
        const A = arr.find((x) => String(x.id) === a);
        const B = arr.find((x) => String(x.id) === b);
        return !!(A && B && String(A.parent || '') === String(B.parent || ''));
      },
      (id, targetId, before) => {
        const arr = loadKb();
        const drag = arr.find((x) => String(x.id) === id);
        if (!drag) { renderKb(pane); return; }
        const group = arr.filter((x) => String(x.parent || '') === String(drag.parent || ''))
          .sort((a, b) => (a.order || 0) - (b.order || 0)
            || String(a.name || '').localeCompare(String(b.name || ''), 'zh'));
        group.splice(group.indexOf(drag), 1);
        const ti = group.findIndex((x) => String(x.id) === targetId);
        if (ti < 0) { renderKb(pane); return; }
        group.splice(before ? ti : ti + 1, 0, drag);
        group.forEach((g, i) => { g.order = i; });
        if (saveKb(arr)) renderKb(pane);
      });

    pane.addEventListener('click', (e) => {
      // 📁：归档到文件夹（与指纹库一致）
      const fb = e.target.closest && e.target.closest('.fx-l-filebtn');
      if (fb) {
        const arr = loadKb();
        const it = arr.find((x) => String(x.id) === fb.closest('tr').dataset.id);
        if (!it) return;
        const curView = pane.dataset.folder || '';
        const pre = (curView && curView !== '*') ? curView : String(it.folder || '').trim();
        const name = window.prompt('归档到哪个文件夹？（输入名字=归档/移动到该文件夹；清空=移出文件夹）', pre);
        if (name === null) return; // 取消
        it.folder = name.trim();
        if (saveKb(arr)) renderKb(pane);
        importToast(it.folder ? `📁 已归档到「${esc(it.folder)}」` : '📁 已移出文件夹');
        return;
      }
      const del = e.target.closest && e.target.closest('.fx-k-del');
      if (del) {
        saveKb(loadKb().filter((x) => String(x.id) !== del.closest('tr').dataset.id));
        renderKb(pane);
        return;
      }
      const imgdel = e.target.closest && e.target.closest('.fx-k-imgdel');
      if (imgdel) {
        const arr = loadKb();
        const it = arr.find((x) => String(x.id) === imgdel.closest('tr').dataset.id);
        if (it && it.images) {
          it.images.splice(+imgdel.dataset.i, 1);
          if (saveKb(arr)) renderKb(pane);
        }
        return;
      }
      const thumb = e.target.closest && e.target.closest('.fx-k-thumb');
      if (thumb) {
        const it = loadKb().find((x) => String(x.id) === thumb.closest('tr').dataset.id);
        if (it && it.images && it.images[+thumb.dataset.i]) kbLightbox(it.images[+thumb.dataset.i]);
        return;
      }
      const addimg = e.target.closest && e.target.closest('.fx-k-addimg');
      if (addimg) {
        const tr = addimg.closest('tr');
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.style.display = 'none';
        inp.addEventListener('change', () => {
          const f = inp.files && inp.files[0];
          inp.remove();
          if (f) kbAddImage(pane, tr.dataset.id, f);
        });
        document.body.appendChild(inp);
        inp.click();
        return;
      }
      if (e.target.closest('.fx-k-add')) {
        const arr = loadKb();
        const it = newKbEntry();
        // 在某个文件夹视图里新建时自动归档进该文件夹
        const fv = pane.dataset.folder || '';
        it.folder = (fv && fv !== '*') ? fv : '';
        arr.push(it);
        saveKb(arr);
        const si = pane.querySelector('.fx-k-search'); // 清掉过滤，保证新行可见
        if (si) { si.value = ''; pane.dataset.filter = ''; }
        renderKb(pane);
        // 表格按母厂分组排序，新行不一定在顶部：按 id 定位新行聚焦
        const cell = pane.querySelector(`tbody tr[data-id="${it.id}"] td[contenteditable]`);
        if (cell) { cell.focus(); cell.scrollIntoView({ block: 'nearest' }); }
        return;
      }
      if (e.target.closest('.fx-k-expj')) {
        downloadFile('fofa-toolbox-kb.json', JSON.stringify(loadKb(), null, 2), 'application/json');
        return;
      }
      if (e.target.closest('.fx-k-impj')) { kbImport(pane); return; }
    });
  }

  /* ---------------- Alt + 左键拖拽：框选批量 ----------------
     框住一块区域后，识别其中所有可排除对象（侧栏排名条目/结果行 favicon/
     国旗/服务器图标/相关Icon），合并进批量面板，一次排除/包含。 */

  let rubber = null;    // {x, y, engaged, overlay, rect}
  let swallowClickUntil = 0;

  function intersects(el, R) {
    const r = el.getBoundingClientRect();
    return r.left < R.r && r.right > R.l && r.top < R.b && r.bottom > R.t;
  }

  function collectInRect(R) {
    const cur = currentQuery();
    const out = [];
    const push = (c) => {
      c = String(c || '').replace(/\s+/g, ' ').trim();
      if (!c || out.includes(c)) return;
      if (c.includes('="-"') || c.includes('=="-"')) return; // FOFA 的未知值占位符
      out.push(c);
    };
    // 1) 侧栏排名条目（分类/Server/国家/端口/证书组织…）
    for (const a of document.querySelectorAll('.hsxa-meta-data-statistical-list a[href*="qbase64="]')) {
      if (!intersects(a, R)) continue;
      const lq = queryFromUrl(a.href);
      if (!lq) continue;
      const cond = extractNew(lq, cur) || selfCondition(lq, firstText(a));
      if (cond) push(ensurePos(cond));
    }
    // 2) 结果行 favicon（icon_hash）
    for (const img of document.querySelectorAll('img.el-image__inner')) {
      if (!intersects(img, R)) continue;
      const link = img.closest('a[href*="qbase64="]');
      if (!link) continue;
      const lq = queryFromUrl(link.href);
      if (!lq) continue;
      const cond = extractNew(lq, cur) || selfCondition(lq, firstText(link));
      if (cond) push(ensurePos(cond));
    }
    // 3) 国旗
    for (const img of document.querySelectorAll('img.hsxa-country-img')) {
      if (intersects(img, R)) {
        const c = countryFromFlag(img);
        if (c) push(ensurePos(c));
      }
    }
    // 4) 服务器图标
    for (const sp of document.querySelectorAll('span.hsxa-server-icon')) {
      if (intersects(sp, R)) {
        const c = serverFromIcon(sp);
        if (c) push(ensurePos(c));
      }
    }
    // 5) 侧栏“相关Icon”
    for (const img of document.querySelectorAll('.icon_hash-icon-list img')) {
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
    const ov = document.getElementById('fofa-toolbox-rubber');
    if (ov) ov.remove();
    document.documentElement.style.userSelect = '';
    if (!r || cancelled || !r.engaged || !r.rect) return null;
    // 只吞拖拽结束瞬间的误触点击（浏览器会在松开处补发 click），限时以免吃掉随后面板上的操作
    swallowClickUntil = Date.now() + 350;
    return r.rect;
  }

  document.addEventListener('mousedown', (e) => {
    if (!e.altKey || e.button !== 0) return;
    if ((menu && menu.contains(e.target)) || (e.target.closest && e.target.closest('#fofa-toolbox-stage-bar,#fofa-toolbox-stage-panel'))) return;
    rubber = { x: e.clientX, y: e.clientY, engaged: false };
  }, true);

  document.addEventListener('mousemove', (e) => {
    if (!rubber) return;
    if (!rubber.engaged && Math.abs(e.clientX - rubber.x) < 6 && Math.abs(e.clientY - rubber.y) < 6) return;
    if (!rubber.engaged) {
      rubber.engaged = true;
      const ov = document.createElement('div');
      ov.id = 'fofa-toolbox-rubber';
      document.documentElement.appendChild(ov);
      document.documentElement.style.userSelect = 'none';
      rubber.overlay = ov;
    }
    e.preventDefault();
    const l = Math.min(rubber.x, e.clientX), t = Math.min(rubber.y, e.clientY);
    const w = Math.abs(e.clientX - rubber.x), h = Math.abs(e.clientY - rubber.y);
    Object.assign(rubber.overlay.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
    rubber.rect = { l, t, r: l + w, b: t + h };
  }, true);

  document.addEventListener('mouseup', (e) => {
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

  document.addEventListener('click', (e) => {
    if (Date.now() < swallowClickUntil) { swallowClickUntil = 0; e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* ---------------- 事件绑定 ---------------- */

  document.addEventListener('contextmenu', (e) => {
    if (menu && menu.contains(e.target)) { e.preventDefault(); return; }
    hideMenu();
    const cand = findCandidate(e);
    if (!cand) return; // 未识别目标：保持原生右键菜单
    e.preventDefault();
    showMenu(e.clientX, e.clientY, cand);
  }, true);

  document.addEventListener('mousedown', (e) => {
    if (menu && !menu.contains(e.target)) hideMenu();
    const p = document.getElementById('fofa-toolbox-stage-panel');
    if (p && !p.contains(e.target) && !(e.target.closest && e.target.closest('#fofa-toolbox-stage-bar'))) hideStagePanel();
    const lib = document.getElementById('fofa-toolbox-box');
    // 管理预设浮层 / 导出选项对话框是工具箱的附属浮层：点它们不算“点外部”
    if (lib && !lib.contains(e.target) && !(e.target.closest && e.target.closest('#fofa-toolbox-btn,#fofa-imp-toast,#fofa-kb-lightbox,#fofa-preset-mgr,#fofa-export-choice'))) closeToolbox(true);
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const lb = document.getElementById('fofa-kb-lightbox');
      if (lb) { lb.remove(); return; } // 灯箱开着时只关灯箱，不连带关工具箱
      const mgr = document.getElementById('fofa-preset-mgr');
      if (mgr) { mgr.remove(); return; } // 管理预设浮层同理，逐层关闭
      hideMenu(); hideStagePanel(); rubberStop(true); closeToolbox(true);
    }
  }, true);

  // Alt+Q 开关工具箱；Alt+A / Alt+O 编辑器快捷键（编辑器标签页激活时）
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.shiftKey || e.isComposing) return;
    if (e.code === 'KeyQ') {
      e.preventDefault();
      if (document.getElementById('fofa-toolbox-box')) closeToolbox(true); else openToolbox();
      return;
    }
    const pane = document.querySelector('#fofa-toolbox-box .fx-t-pane-edit');
    if (pane && pane.classList.contains('on') && editMain) {
      if (e.code === 'KeyA') { e.preventDefault(); editMain.addItem('card'); }
      else if (e.code === 'KeyO') { e.preventDefault(); editMain.addItem('row'); }
    }
  }, true);

  window.addEventListener('scroll', hideMenu, true);
  window.addEventListener('resize', hideMenu);
})();
