// ==UserScript==
// @name         FOFA 右键排除搜索
// @namespace    fofa.exclude.menu
// @version      2.5.0
// @description  在 FOFA 结果页右键组件/产品/favicon/国旗/侧栏世界地图/相关Icon/服务器图标/IP/端口等元素，将该项取反（如 product!="HIKVISION-视频监控"、icon_hash!="-1940193079"、country!="DE"）追加到当前搜索语句并在新标签页打开；也支持包含、复制完整语句。新标签保留 opener 关系（Tree Style Tab 树状归属）。Shift+右键 = 原生菜单
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
  const VER = '2.5.0';

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

  function guessField(el) {
    const p = el && el.closest
      ? el.closest('[class*="title"],[class*="domain"],[class*="host"],[class*="component"],[class*="product"],[class*="server"],[class*="org"],[class*="country"],[class*="protocol"],[class*="port"]')
      : null;
    const cls = p ? String(p.className || '') : '';
    if (/title/i.test(cls)) return 'title';
    if (/domain/i.test(cls)) return 'domain';
    if (/host/i.test(cls)) return 'host';
    if (/org/i.test(cls)) return 'org';
    if (/countr/i.test(cls)) return 'country';
    if (/protocol/i.test(cls)) return 'protocol';
    if (/port/i.test(cls)) return 'port';
    if (/server/i.test(cls)) return 'server';
    return 'product';
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
        if (cond) return { cur, cond: negate(cond) || `${guessField(link)}="${firstText(link).slice(0, MAX_TEXT_LEN)}"`, include: cond };
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

  /* ---------------- 打开 / 复制 ---------------- */

  function openTab(query) {
    const url = `${location.origin}/result?qbase64=${encodeURIComponent(b64enc(query))}`;
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
#fofa-exclude-menu .fx-copy{padding:5px 8px}`;
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
        <button class="fx-copy" title="复制排除后的完整语句">📋</button>
      </div>`;

    const input = menu.querySelector('.fx-cond');
    input.value = cand.cond;
    let edited = false;
    input.addEventListener('input', () => { edited = true; });

    const getCond = () => input.value.replace(/\s+/g, ' ').trim();
    const compose = (cond) => (cand.cur ? `${cand.cur} && ${cond}` : cond);

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
  }

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
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu) hideMenu();
  }, true);

  window.addEventListener('scroll', hideMenu, true);
  window.addEventListener('resize', hideMenu);
})();
