// ==UserScript==
// @name         FOFA 右键排除搜索
// @namespace    fofa.exclude.menu
// @version      3.0.0
// @description  FOFA 增强工具：右键任意元素（组件/favicon/国旗/世界地图/相关Icon/各排名条目…）排除或包含该条件并在新标签打开；Alt+拖拽框选批量排除；指纹收藏库（记录搜索语句+IP数/厂商/型号/地区等，表格编辑、本地存储、JSON/CSV 导出）。Shift+右键 = 原生菜单
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
  const VER = '3.0.0';

  console.info(`[FOFA排除搜索] v${VER} 已加载（${location.host}）— 若右键无反应，请先确认控制台显示的是本版本号`);

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
      if (c === ')') { depth--; buf += c; continue; }
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
    const walk = (q) => {
      const extra = [];
      for (const s of splitTop(q)) {
        if (cur.includes(s)) continue;
        const inner = s.startsWith('(') && s.endsWith(')') ? s.slice(1, -1) : null;
        if (inner !== null && cur.includes(norm(inner))) continue; // 只是加了层括号
        if (inner !== null) { const r = walk(inner); if (r) return r; }   // 组内找新增
        extra.push(s);
      }
      return extra.length === 1 ? extra[0] : null;
    };
    return walk(lq);
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
        // 自引用链接（无新增条件，如分类排名里当前选中的第一条）→ 就地取反
        if (cur) {
          const self = selfCondition(lq, firstText(link));
          if (self) return { cur, cond: negate(self) || self, include: self, replace: self };
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

  const STAGE_KEY = 'fofa-exclude-staged';
  const CURWIN_KEY = 'fofa-exclude-current';

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
  function applyBatch(cur, conds, mode) {
    let q = (cur || '').trim();
    for (const c of conds) {
      const clean = String(c).replace(/\s+/g, ' ').trim();
      if (!clean) continue;
      if (q.includes(clean)) {
        if (mode === 'exclude') q = q.replace(clean, negate(clean) || clean);
        continue;
      }
      const piece = mode === 'exclude' ? (negate(clean) || clean) : clean;
      q = q ? q + ' && ' + piece : piece;
    }
    return q;
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

  function injectStyle() {
    if (document.getElementById('fofa-exclude-style')) return;
    const st = document.createElement('style');
    st.id = 'fofa-exclude-style';
    st.textContent = `
#fofa-exclude-menu{position:fixed;z-index:2147483647;width:340px;box-sizing:border-box;background:#fff;color:#24292f;
  border:1px solid #d0d7de;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.14);padding:8px;
  font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
#fofa-exclude-menu .fx-cur{color:#57606a;font-size:11px;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;user-select:text}
#fofa-exclude-menu .fx-cond{width:100%;box-sizing:border-box;background:#fff;border:1px solid #d0d7de;border-radius:6px;
  color:#24292f;padding:5px 8px;font:12px/1.4 Consolas,Menlo,monospace;outline:none}
#fofa-exclude-menu .fx-cond:focus{border-color:#f1961f}
#fofa-exclude-menu .fx-btns{display:flex;gap:6px;margin-top:8px}
#fofa-exclude-menu .fx-btns button{border:1px solid #d0d7de;border-radius:6px;padding:5px 10px;cursor:pointer;
  font:12px/1.4 inherit;background:#f6f8fa;color:#24292f;white-space:nowrap}
#fofa-exclude-menu .fx-btns button:hover{background:#eef1f4}
#fofa-exclude-menu .fx-primary{flex:1;background:#f1961f;border-color:#f1961f;color:#fff;font-weight:600}
#fofa-exclude-menu .fx-primary:hover{background:#ffab2e;border-color:#ffab2e}
#fofa-exclude-menu .fx-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;color:#8b949e;font-size:10px;margin-top:6px}
#fofa-exclude-menu .fx-copy,#fofa-exclude-menu .fx-stage{padding:5px 8px}
#fofa-exclude-menu .fx-curwin{display:flex;align-items:center;gap:3px;cursor:pointer;user-select:none}
#fofa-exclude-menu .fx-curwin input{margin:0;accent-color:#f1961f}
#fofa-exclude-stage-bar{position:fixed;right:12px;bottom:12px;z-index:2147483646;background:#f1961f;color:#fff;border-radius:16px;
  padding:4px 12px;font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer;
  box-shadow:0 4px 14px rgba(0,0,0,.28);user-select:none}
#fofa-exclude-stage-bar:hover{background:#ffab2e}
#fofa-exclude-stage-panel{position:fixed;right:12px;bottom:48px;z-index:2147483647;width:380px;box-sizing:border-box;
  background:#fff;color:#24292f;border:1px solid #d0d7de;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.14);padding:8px;
  font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
#fofa-exclude-stage-panel .fx-p-title{font-weight:600;color:#57606a;margin-bottom:6px}
#fofa-exclude-stage-panel .fx-p-list{max-height:200px;overflow:auto}
#fofa-exclude-stage-panel .fx-p-item{display:flex;align-items:center;gap:6px;padding:3px 4px;border-radius:4px}
#fofa-exclude-stage-panel .fx-p-item:hover{background:#f6f8fa}
#fofa-exclude-stage-panel .fx-p-item span{flex:1;font-family:Consolas,Menlo,monospace;font-size:11px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
#fofa-exclude-stage-panel .fx-p-item b{cursor:pointer;color:#8b949e;font-weight:400;padding:0 4px}
#fofa-exclude-stage-panel .fx-p-item b:hover{color:#e5484d}
#fofa-exclude-stage-panel .fx-p-btns{display:flex;gap:6px;margin-top:8px}
#fofa-exclude-stage-panel .fx-p-btns button{border:1px solid #d0d7de;border-radius:6px;padding:5px 8px;cursor:pointer;
  font:12px/1.4 inherit;background:#f6f8fa;color:#24292f;white-space:nowrap}
#fofa-exclude-stage-panel .fx-p-btns button:hover{background:#eef1f4}
#fofa-exclude-stage-panel .fx-p-primary{flex:1;background:#f1961f;border-color:#f1961f;color:#fff;font-weight:600}
#fofa-exclude-stage-panel .fx-p-primary:hover{background:#ffab2e;border-color:#ffab2e}
#fofa-exclude-rubber{position:fixed;z-index:2147483646;border:1.5px dashed #f1961f;background:rgba(241,150,31,.12);
  pointer-events:none}
#fofa-exclude-lib-btn{position:fixed;left:12px;bottom:12px;z-index:2147483646;background:#fff;color:#57606a;
  border:1px solid #d0d7de;border-radius:16px;padding:4px 12px;cursor:pointer;user-select:none;
  font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.2)}
#fofa-exclude-lib-btn:hover{color:#f1961f;border-color:#f1961f}
#fofa-exclude-lib{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;width:900px;
  max-width:94vw;max-height:84vh;display:flex;flex-direction:column;background:#fff;color:#24292f;border:1px solid #d0d7de;
  border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden;
  font:12px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
#fofa-exclude-lib .fx-l-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #eef1f4}
#fofa-exclude-lib .fx-l-title{font-weight:600}
#fofa-exclude-lib .fx-l-hbtns{display:flex;gap:6px}
#fofa-exclude-lib .fx-l-hbtns button{border:1px solid #d0d7de;background:#f6f8fa;border-radius:6px;padding:4px 10px;
  cursor:pointer;font:12px/1.4 inherit;color:#24292f}
#fofa-exclude-lib .fx-l-hbtns button:hover{background:#eef1f4}
#fofa-exclude-lib .fx-l-tablewrap{overflow:auto;flex:1}
#fofa-exclude-lib .fx-l-table{border-collapse:collapse;width:100%}
#fofa-exclude-lib .fx-l-table th{position:sticky;top:0;background:#f6f8fa;color:#57606a;font-weight:600;text-align:left;
  padding:6px 8px;border-bottom:1px solid #eef1f4;white-space:nowrap}
#fofa-exclude-lib .fx-l-table td{padding:5px 8px;border-bottom:1px solid #f0f2f5;vertical-align:top;word-break:break-all}
#fofa-exclude-lib .fx-l-table td[contenteditable]:focus{outline:1.5px solid #f1961f;outline-offset:-1.5px;background:#fffdf5}
#fofa-exclude-lib .fx-l-mono{font-family:Consolas,Menlo,monospace;font-size:11px}
#fofa-exclude-lib .fx-l-ops b{cursor:pointer;color:#8b949e;font-weight:400;margin-right:6px}
#fofa-exclude-lib .fx-l-ops b.fx-l-search:hover{color:#f1961f}
#fofa-exclude-lib .fx-l-ops b.fx-l-del:hover{color:#e5484d}
#fofa-exclude-lib .fx-l-empty{color:#8b949e;text-align:center;padding:24px}
#fofa-exclude-lib .fx-l-foot{padding:6px 12px;color:#8b949e;font-size:11px;border-top:1px solid #eef1f4}`;
    document.head.appendChild(st);
  }

  function hideMenu() {
    if (menu) { menu.remove(); menu = null; }
  }

  function showMenu(x, y, cand) {
    hideMenu();
    injectStyle();

    menu = document.createElement('div');
    menu.id = 'fofa-exclude-menu';
    menu.innerHTML = `
      <div class="fx-cur" title="${esc(cand.cur || '当前页面无搜索语句')}">${esc(cand.cur || '无当前语句')}</div>
      <input class="fx-cond" spellcheck="false" placeholder='例如 product="HIKVISION-视频监控" 或 icon_hash="-1940193079"'>
      <div class="fx-btns">
        <button class="fx-primary" title="将该条件取反后追加到当前语句，并在新标签页打开">🚫 排除并打开</button>
        <button class="fx-inc" title="将该条件追加到当前语句，并在新标签页打开">➕ 包含</button>
        <button class="fx-stage" title="暂存此条件，稍后在右下角批量排除/包含">📥 暂存</button>
        <button class="fx-lib" title="收藏当前搜索语句到指纹库（自动记录 IP 条数，可补充厂商/型号/地区）">⭐</button>
        <button class="fx-copy" title="复制排除后的完整语句">📋</button>
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
    // 自引用条件（当前语句已含）：未编辑时就地替换该条件；否则追加
    const compose = (cond) => {
      if (!cand.cur) return cond;
      if (cand.replace && !edited) return cand.cur.replace(cand.replace, cond);
      return `${cand.cur} && ${cond}`;
    };
    if (cand.replace) {
      const btn = menu.querySelector('.fx-primary');
      btn.title = '当前语句已包含此条件：把它就地取反后打开（而非追加）';
    }

    const doOpen = (mode) => {
      const cond = getCond();
      if (!cond) { input.focus(); return; }
      // 包含：未编辑时用链接里的原始条件（保留 FOFA 的 == 精确匹配语义）
      const final = mode === 'include' ? (!edited && cand.include ? cand.include : ensurePos(cond)) : ensureNeg(cond);
      openTab(compose(final));
      hideMenu();
    };

    menu.querySelector('.fx-primary').addEventListener('click', () => doOpen('exclude'));
    menu.querySelector('.fx-inc').addEventListener('click', () => doOpen('include'));
    menu.querySelector('.fx-copy').addEventListener('click', (ev) => {
      const cond = getCond();
      if (!cond) { input.focus(); return; }
      copyText(compose(ensureNeg(cond)), ev.currentTarget);
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); doOpen('exclude'); }
    });

    document.documentElement.appendChild(menu);

    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
    input.focus();
    if (cand.cond) input.select();

    // 暂存：存为包含形式（=），批量应用时再决定取反与否
    menu.querySelector('.fx-stage').addEventListener('click', (ev) => {
      const cond = ensurePos(getCond());
      if (!cond) { input.focus(); return; }
      const arr = loadStaged();
      if (!arr.includes(cond)) arr.push(cond);
      saveStaged(arr);
      ensureStagedBar();
      const btn = ev.currentTarget;
      btn.textContent = '✓ 已暂存';
      setTimeout(hideMenu, 450);
    });

    // 收藏当前搜索语句到指纹库（自动记录 IP 条数）
    menu.querySelector('.fx-lib').addEventListener('click', (ev) => {
      const ok = addFingerprint();
      const btn = ev.currentTarget;
      btn.textContent = ok ? '✓' : '⚠';
      setTimeout(() => { btn.textContent = '⭐'; }, 900);
      if (ok) setTimeout(hideMenu, 450);
    });
  }

  /* ---------------- 批量暂存：右下角徽标 + 面板 ---------------- */

  function hideStagePanel() {
    const p = document.getElementById('fofa-exclude-stage-panel');
    if (p) p.remove();
  }

  function ensureStagedBar() {
    const n = loadStaged().length;
    let bar = document.getElementById('fofa-exclude-stage-bar');
    if (!n) {
      if (bar) bar.remove();
      hideStagePanel();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'fofa-exclude-stage-bar';
      bar.title = '已暂存的条件，点击批量排除/包含';
      bar.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = document.getElementById('fofa-exclude-stage-panel');
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
    panel.id = 'fofa-exclude-stage-panel';
    panel.innerHTML = `
      <div class="fx-p-title">已暂存 ${arr.length} 个条件（排除时已存在于当前语句的会被就地取反）</div>
      <div class="fx-p-list">${arr.map((c, i) =>
        `<div class="fx-p-item"><span title="${esc(c)}">${esc(c)}</span><b data-i="${i}" title="移除">×</b></div>`
      ).join('')}</div>
      <div class="fx-p-btns">
        <button class="fx-p-primary" title="把全部暂存条件取反后并入当前语句并打开">🚫 全部排除并打开</button>
        <button class="fx-p-inc" title="把全部暂存条件并入当前语句并打开">➕ 全部包含</button>
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
      if (e.target.closest('.fx-p-primary')) apply('exclude');
      else if (e.target.closest('.fx-p-inc')) apply('include');
      else if (e.target.closest('.fx-p-clear')) { saveStaged([]); ensureStagedBar(); }
    });

    document.documentElement.appendChild(panel);
  }

  setInterval(ensureStagedBar, 2000); // SPA 重渲染后补回徽标
  ensureStagedBar();

  /* ---------------- 指纹收藏库 ----------------
     记录搜索语句（指纹），附带 IP 条数（自动抓取）/厂商/型号/地区等自定义字段，
     表格式编辑，localStorage 持久化，支持 JSON / CSV 导出。 */

  const LIB_KEY = 'fofa-fingerprints';
  const LIB_FIELDS = [
    { key: 'name', label: '名称', w: '90px' },
    { key: 'query', label: '搜索语句', w: '220px', mono: true },
    { key: 'ip', label: 'IP数', w: '70px' },
    { key: 'vendor', label: '厂商', w: '90px' },
    { key: 'model', label: '型号', w: '90px' },
    { key: 'region', label: '地区', w: '90px' },
    { key: 'note', label: '备注', w: '120px' }
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

  function addFingerprint() {
    const q = currentQuery();
    if (!q) return false;
    const c = grabCounts();
    // 骨架渲染期计数可能显示 0，视为未知存空
    const clean = (v) => (v && v !== '0' ? v : '');
    const nameM = /"([^"]+)"/.exec(q);
    const arr = loadLib();
    arr.unshift({
      id: Date.now(),
      name: nameM ? nameM[1] : '未命名',
      query: q,
      ip: clean(c.ip) || clean(c.total),
      vendor: '', model: '', region: '', note: '',
      ts: new Date().toLocaleString()
    });
    saveLib(arr);
    return true;
  }

  const csvCell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  function libToCsv(arr) {
    const head = ['名称', '搜索语句', 'IP数', '厂商', '型号', '地区', '备注', '收藏时间'];
    const lines = [head.map(csvCell).join(',')];
    for (const it of arr) {
      lines.push([it.name, it.query, it.ip, it.vendor, it.model, it.region, it.note, it.ts].map(csvCell).join(','));
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

  function closeLib() {
    const p = document.getElementById('fofa-exclude-lib');
    if (p) p.remove();
  }

  function openLib() {
    closeLib();
    injectStyle();
    const panel = document.createElement('div');
    panel.id = 'fofa-exclude-lib';
    renderLib(panel);
    document.documentElement.appendChild(panel);
  }

  function renderLib(panel) {
    const arr = loadLib();
    const rows = arr.map((it) => `<tr data-id="${it.id}">${LIB_FIELDS.map((f) =>
      `<td${f.mono ? ' class="fx-l-mono"' : ''} data-f="${f.key}" contenteditable="true" spellcheck="false">${esc(it[f.key] || '')}</td>`
    ).join('')}<td class="fx-l-ops"><b class="fx-l-search" title="用此语句搜索">🔍</b><b class="fx-l-del" title="删除此条">✕</b></td></tr>`).join('');
    panel.innerHTML = `
      <div class="fx-l-head">
        <span class="fx-l-title">🗂 指纹收藏库（${arr.length}）</span>
        <span class="fx-l-hbtns">
          <button class="fx-l-add" title="手动新建一条空记录">＋ 新建</button>
          <button class="fx-l-expj" title="导出为 JSON 文件">导出 JSON</button>
          <button class="fx-l-expc" title="导出为 CSV 文件（Excel 可直接打开）">导出 CSV</button>
          <button class="fx-l-close">关闭</button>
        </span>
      </div>
      <div class="fx-l-tablewrap"><table class="fx-l-table">
        <thead><tr>${LIB_FIELDS.map((f) => `<th style="width:${f.w}">${f.label}</th>`).join('')}<th>操作</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="8" class="fx-l-empty">暂无条目：在右键菜单点 ⭐ 收藏当前语句，或点「新建」手动添加</td></tr>'}</tbody>
      </table></div>
      <div class="fx-l-foot">单元格点击即可编辑，失焦自动保存 · 🔍 用该语句搜索 · 数据保存在浏览器本地（localStorage）</div>`;

    // 单元格编辑（focusout 冒泡，一次委托即可）
    panel.addEventListener('focusout', (e) => {
      const td = e.target.closest && e.target.closest('td[contenteditable][data-f]');
      if (!td) return;
      const tr = td.closest('tr');
      const arr2 = loadLib();
      const it = arr2.find((x) => String(x.id) === tr.dataset.id);
      if (!it) return;
      it[td.dataset.f] = td.innerText.replace(/\u00a0/g, ' ').trim();
      saveLib(arr2);
    });

    panel.addEventListener('click', (e) => {
      const del = e.target.closest && e.target.closest('.fx-l-del');
      if (del) {
        const id = del.closest('tr').dataset.id;
        saveLib(loadLib().filter((x) => String(x.id) !== id));
        renderLib(panel);
        return;
      }
      const search = e.target.closest && e.target.closest('.fx-l-search');
      if (search) {
        const id = search.closest('tr').dataset.id;
        const it = loadLib().find((x) => String(x.id) === id);
        if (it && it.query) openTab(it.query);
        return;
      }
      if (e.target.closest('.fx-l-add')) {
        const arr2 = loadLib();
        arr2.unshift({ id: Date.now(), name: '', query: '', ip: '', vendor: '', model: '', region: '', note: '', ts: new Date().toLocaleString() });
        saveLib(arr2);
        renderLib(panel);
        const first = panel.querySelector('tbody td[contenteditable]');
        if (first) { first.focus(); }
        return;
      }
      if (e.target.closest('.fx-l-expj')) {
        downloadFile('fofa-fingerprints.json', JSON.stringify(loadLib(), null, 2), 'application/json');
        return;
      }
      if (e.target.closest('.fx-l-expc')) {
        downloadFile('fofa-fingerprints.csv', libToCsv(loadLib()), 'text/csv');
        return;
      }
      if (e.target.closest('.fx-l-close')) closeLib();
    });
  }

  function ensureLibBtn() {
    if (document.getElementById('fofa-exclude-lib-btn')) return;
    const b = document.createElement('div');
    b.id = 'fofa-exclude-lib-btn';
    b.textContent = '🗂 指纹库';
    b.title = '打开指纹收藏库';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (document.getElementById('fofa-exclude-lib')) closeLib(); else openLib();
    });
    document.documentElement.appendChild(b);
  }
  setInterval(ensureLibBtn, 2000); // SPA 重渲染后补回按钮
  ensureLibBtn();

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
    const ov = document.getElementById('fofa-exclude-rubber');
    if (ov) ov.remove();
    document.documentElement.style.userSelect = '';
    if (!r || cancelled || !r.engaged || !r.rect) return null;
    // 只吞拖拽结束瞬间的误触点击（浏览器会在松开处补发 click），限时以免吃掉随后面板上的操作
    swallowClickUntil = Date.now() + 350;
    return r.rect;
  }

  document.addEventListener('mousedown', (e) => {
    if (!e.altKey || e.button !== 0) return;
    if ((menu && menu.contains(e.target)) || (e.target.closest && e.target.closest('#fofa-exclude-stage-bar,#fofa-exclude-stage-panel'))) return;
    rubber = { x: e.clientX, y: e.clientY, engaged: false };
  }, true);

  document.addEventListener('mousemove', (e) => {
    if (!rubber) return;
    if (!rubber.engaged && Math.abs(e.clientX - rubber.x) < 6 && Math.abs(e.clientY - rubber.y) < 6) return;
    if (!rubber.engaged) {
      rubber.engaged = true;
      const ov = document.createElement('div');
      ov.id = 'fofa-exclude-rubber';
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
    const p = document.getElementById('fofa-exclude-stage-panel');
    if (p && !p.contains(e.target) && !(e.target.closest && e.target.closest('#fofa-exclude-stage-bar'))) hideStagePanel();
    const lib = document.getElementById('fofa-exclude-lib');
    if (lib && !lib.contains(e.target) && !(e.target.closest && e.target.closest('#fofa-exclude-lib-btn'))) closeLib();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideMenu(); hideStagePanel(); rubberStop(true); closeLib(); }
  }, true);

  window.addEventListener('scroll', hideMenu, true);
  window.addEventListener('resize', hideMenu);
})();
