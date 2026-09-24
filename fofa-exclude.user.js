// ==UserScript==
// @name         FOFA 右键排除搜索
// @namespace    fofa.exclude.menu
// @version      2.0.0
// @description  在 FOFA 结果页右键组件/产品/国家旗帜/协议图标/favicon，将该项取反（如 product!="HIKVISION-视频监控"、country!="CN"、icon_hash!="xxx"）追加到当前搜索语句并在新标签页打开；也支持包含、复制完整语句
// @match        *://fofa.info/*
// @match        *://*.fofa.info/*
// @match        *://fofa.so/*
// @match        *://*.fofa.so/*
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      *
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const OPEN_IN_BACKGROUND = false; // 新标签页是否在后台打开
  const MAX_TEXT_LEN = 60;          // 兜底取词的最大文本长度

  // 右键到这些“看起来可点击”的元素时，用其文本兜底（Vue 的 @click 不会产生 onclick 属性）
  const CLICKABLE_SEL = [
    'a', '[onclick]', '[role="button"]', 'img', 'svg',
    '[class*="icon"]', '[class*="component"]', '[class*="product"]', '[class*="tag"]',
    '[class*="label"]', '[class*="filter"]', '[class*="category"]', '[class*="chip"]',
    '[class*="port"]', '[class*="protocol"]', '[class*="flag"]', '[class*="country"]',
    '[class*="nation"]', '[class*="region"]', '[class*="favicon"]', '[class*="logo"]'
  ].join(',');

  /* ---------------- 国家与协议映射 ---------------- */

  // ISO 3166-1 alpha-2 -> 英文名（代码本身即可直接用于 country="CN"）
  const COUNTRY = {
    AD:'Andorra',AE:'United Arab Emirates',AF:'Afghanistan',AG:'Antigua and Barbuda',AI:'Anguilla',AL:'Albania',AM:'Armenia',AO:'Angola',AR:'Argentina',AS:'American Samoa',AT:'Austria',AU:'Australia',AW:'Aruba',AZ:'Azerbaijan',
    BA:'Bosnia and Herzegovina',BB:'Barbados',BD:'Bangladesh',BE:'Belgium',BF:'Burkina Faso',BG:'Bulgaria',BH:'Bahrain',BI:'Burundi',BJ:'Benin',BM:'Bermuda',BN:'Brunei',BO:'Bolivia',BR:'Brazil',BS:'Bahamas',BT:'Bhutan',BW:'Botswana',BY:'Belarus',BZ:'Belize',
    CA:'Canada',CD:'DR Congo',CF:'Central African Republic',CG:'Congo',CH:'Switzerland',CI:'Cote d\'Ivoire',CL:'Chile',CM:'Cameroon',CN:'China',CO:'Colombia',CR:'Costa Rica',CU:'Cuba',CV:'Cape Verde',CW:'Curacao',CY:'Cyprus',CZ:'Czechia',
    DE:'Germany',DJ:'Djibouti',DK:'Denmark',DM:'Dominica',DO:'Dominican Republic',DZ:'Algeria',
    EC:'Ecuador',EE:'Estonia',EG:'Egypt',ER:'Eritrea',ES:'Spain',ET:'Ethiopia',
    FI:'Finland',FJ:'Fiji',FM:'Micronesia',FO:'Faroe Islands',FR:'France',
    GA:'Gabon',GB:'United Kingdom',GD:'Grenada',GE:'Georgia',GF:'French Guiana',GG:'Guernsey',GH:'Ghana',GI:'Gibraltar',GL:'Greenland',GM:'Gambia',GN:'Guinea',GP:'Guadeloupe',GQ:'Equatorial Guinea',GR:'Greece',GT:'Guatemala',GU:'Guam',GW:'Guinea-Bissau',GY:'Guyana',
    HK:'Hong Kong',HN:'Honduras',HR:'Croatia',HT:'Haiti',HU:'Hungary',
    ID:'Indonesia',IE:'Ireland',IL:'Israel',IM:'Isle of Man',IN:'India',IQ:'Iraq',IR:'Iran',IS:'Iceland',IT:'Italy',
    JE:'Jersey',JM:'Jamaica',JO:'Jordan',JP:'Japan',
    KE:'Kenya',KG:'Kyrgyzstan',KH:'Cambodia',KI:'Kiribati',KM:'Comoros',KN:'Saint Kitts and Nevis',KP:'North Korea',KR:'South Korea',KW:'Kuwait',KY:'Cayman Islands',KZ:'Kazakhstan',
    LA:'Laos',LB:'Lebanon',LC:'Saint Lucia',LI:'Liechtenstein',LK:'Sri Lanka',LR:'Liberia',LS:'Lesotho',LT:'Lithuania',LU:'Luxembourg',LV:'Latvia',LY:'Libya',
    MA:'Morocco',MC:'Monaco',MD:'Moldova',ME:'Montenegro',MG:'Madagascar',MH:'Marshall Islands',MK:'North Macedonia',ML:'Mali',MM:'Myanmar',MN:'Mongolia',MO:'Macao',MP:'Northern Mariana Islands',MQ:'Martinique',MR:'Mauritania',MT:'Malta',MU:'Mauritius',MV:'Maldives',MW:'Malawi',MX:'Mexico',MY:'Malaysia',MZ:'Mozambique',
    NA:'Namibia',NC:'New Caledonia',NE:'Niger',NG:'Nigeria',NI:'Nicaragua',NL:'Netherlands',NO:'Norway',NP:'Nepal',NR:'Nauru',NU:'Niue',NZ:'New Zealand',
    OM:'Oman',
    PA:'Panama',PE:'Peru',PF:'French Polynesia',PG:'Papua New Guinea',PH:'Philippines',PK:'Pakistan',PL:'Poland',PR:'Puerto Rico',PS:'Palestine',PT:'Portugal',PW:'Palau',PY:'Paraguay',
    QA:'Qatar',
    RE:'Reunion',RO:'Romania',RS:'Serbia',RU:'Russia',RW:'Rwanda',
    SA:'Saudi Arabia',SB:'Solomon Islands',SC:'Seychelles',SD:'Sudan',SE:'Sweden',SG:'Singapore',SI:'Slovenia',SK:'Slovakia',SL:'Sierra Leone',SM:'San Marino',SN:'Senegal',SO:'Somalia',SR:'Suriname',SS:'South Sudan',SV:'El Salvador',SY:'Syria',SZ:'Eswatini',
    TD:'Chad',TG:'Togo',TH:'Thailand',TJ:'Tajikistan',TL:'Timor-Leste',TM:'Turkmenistan',TN:'Tunisia',TO:'Tonga',TR:'Turkey',TT:'Trinidad and Tobago',TV:'Tuvalu',TW:'Taiwan',TZ:'Tanzania',
    UA:'Ukraine',UG:'Uganda',US:'United States',UY:'Uruguay',UZ:'Uzbekistan',
    VA:'Vatican',VC:'Saint Vincent',VE:'Venezuela',VG:'British Virgin Islands',VI:'U.S. Virgin Islands',VN:'Vietnam',VU:'Vanuatu',
    WF:'Wallis',WS:'Samoa',
    YE:'Yemen',YT:'Mayotte',
    ZA:'South Africa',ZM:'Zambia',ZW:'Zimbabwe'
  };

  // 常见国家的中文名（应对中文界面下 title/文本为国名的情况）
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

  // 国名(小写) -> 代码
  const NAME2CODE = {};
  for (const [code, name] of Object.entries(COUNTRY)) NAME2CODE[name.toLowerCase()] = code;
  Object.assign(NAME2CODE, COUNTRY_ZH);

  const PROTOCOLS = ['http','https','ssh','ftp','sftp','telnet','smtp','pop3','imap','rdp','vnc','snmp','mysql','redis','mongodb','memcached','elasticsearch','rabbitmq','kafka','zookeeper','nfs','smb','ldap','ldaps','dns','socks5','socks4','rtsp','onvif','bacnet','modbus','mqtt','amqp','svn','ipp','mms'];
  const PROTO_SET = new Set(PROTOCOLS);

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

  // 取 URL 路径的最后一段文件名（去掉扩展名），如 .../flags/CN.png -> CN
  function urlBasename(u) {
    try {
      const seg = (new URL(u, location.href).pathname.split('/').filter(Boolean).pop() || '');
      return seg.replace(/\.[a-z0-9]+$/i, '');
    } catch (e) {
      return '';
    }
  }

  /* ---------------- 语句处理 ---------------- */

  function negate(cond) {
    const m = /^\s*([A-Za-z_][\w]*)\s*=(?!=)\s*([\s\S]+?)\s*$/.exec(cond);
    return m ? `${m[1]}!=${m[2]}` : null;
  }
  const ensureNeg = (c) => negate(c) || c.replace(/^(\s*[A-Za-z_][\w]*\s*)=/, '$1!=');
  const ensurePos = (c) => c.replace(/^(\s*[A-Za-z_][\w]*\s*)!=/, '$1=');

  // FOFA 的组件/筛选链接往往是“当前语句 && 新条件”，这里仅取出新增部分；
  // 与当前语句完全相同（如分页链接）时返回 null
  function stripCurrent(linkQuery, current) {
    const cur = (current || '').trim();
    if (cur && linkQuery.startsWith(cur)) {
      const tail = linkQuery.slice(cur.length).replace(/^\s*&&\s*/, '').trim();
      return tail || null;
    }
    return linkQuery;
  }

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
      ? el.closest('[class*="title"],[class*="domain"],[class*="host"],[class*="component"],[class*="product"],[class*="server"],[class*="org"],[class*="country"],[class*="nation"],[class*="region"],[class*="flag"],[class*="protocol"],[class*="port"],[class*="os"]')
      : null;
    const cls = p ? String(p.className || '') : '';
    if (/title/i.test(cls)) return 'title';
    if (/domain/i.test(cls)) return 'domain';
    if (/host/i.test(cls)) return 'host';
    if (/org/i.test(cls)) return 'org';
    if (/countr|nation|region|flag/i.test(cls)) return 'country';
    if (/protocol/i.test(cls)) return 'protocol';
    if (/port/i.test(cls)) return 'port';
    if (/os/i.test(cls)) return 'os';
    return 'product';
  }

  // 无 href 时的深度兜底：向上找 Vue 组件实例（el.__vue__，仅部分站点可用），从常见字段里掏产品名
  function vueProbe(t) {
    try {
      let el = t;
      for (let i = 0; el && i < 12; i++, el = el.parentElement) {
        const v = el.__vue__;
        if (v && typeof v === 'object') {
          const pools = [];
          if (v.$options && v.$options.propsData) pools.push(v.$options.propsData);
          if (v.$attrs) pools.push(v.$attrs);
          if (v._data) pools.push(v._data);
          for (const pool of pools) {
            if (!pool || typeof pool !== 'object') continue;
            for (const k of ['product', 'products', 'component', 'components', 'name', 'label', 'value', 'item', 'data', 'row', 'info']) {
              const val = pool[k];
              if (typeof val === 'string' && val.trim() && val.length <= 80) return val.trim();
              if (val && typeof val === 'object') {
                const arr = Array.isArray(val) ? val : Object.values(val);
                for (const it of arr) {
                  if (typeof it === 'string' && it.trim() && it.length <= 80) return it.trim();
                  if (it && typeof it === 'object') {
                    for (const kk of ['product_name', 'product', 'name', 'title', 'value']) {
                      if (typeof it[kk] === 'string' && it[kk].trim() && it[kk].length <= 80) return it[kk].trim();
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) { /* 页面框架差异，忽略 */ }
    return null;
  }

  /* ---------------- 图片 / 图标识别：国旗、协议 ---------------- */

  const clsOf = (el) => (el && el.className && el.className.baseVal !== undefined) ? el.className.baseVal : String((el && el.className) || '');

  // 识别右键的图片/图标：国家旗帜 -> {field:'country'}，协议图标 -> {field:'protocol'}
  function probeImage(t) {
    const host = t.closest('img, [style*="background-image"], [class*="flag"], [class*="country"], [class*="icon"]');
    if (!host) return null;

    const attr = (el, name) => (el && el.getAttribute && el.getAttribute(name)) || '';
    const classes = [];
    const urls = [];
    for (let el = host, i = 0; el && i < 3; i++, el = el.parentElement) {
      classes.push(clsOf(el));
      const src = attr(el, 'src') || attr(el, 'data-src');
      if (src) urls.push(src);
      const st = attr(el, 'style');
      if (st && /url\(/i.test(st)) urls.push(st);
    }
    try {
      const bg = getComputedStyle(host).backgroundImage;
      if (bg && bg !== 'none') urls.push(bg);
    } catch (e) { /* ignore */ }

    // 1) alt/title 直接是两位国家代码或国名
    for (const s of [attr(host, 'alt'), attr(host, 'title')]) {
      const v = String(s).trim();
      if (!v) continue;
      if (/^[a-zA-Z]{2}$/.test(v) && COUNTRY[v.toUpperCase()]) return { field: 'country', value: v.toUpperCase() };
      const code = NAME2CODE[v.toLowerCase()];
      if (code) return { field: 'country', value: code };
    }

    // 2) URL 文件名是两位代码（.../flags/CN.png、.../CN.svg）
    for (const u of urls) {
      const m = /url\((['"]?)([^'")]+)\1\)/i.exec(String(u)) || [, , String(u)];
      const base = urlBasename(m[2]);
      if (/^[a-zA-Z]{2}$/.test(base) && COUNTRY[base.toUpperCase()]) return { field: 'country', value: base.toUpperCase() };
    }

    // 3) class 含 flag/country 等字样时，从 class 里取两字母段（flag flag-us / country-CN）
    for (const c of classes) {
      const cs = String(c);
      if (!/flag|countr|nation|region/i.test(cs)) continue;
      const re = /(?:^|[^a-zA-Z0-9])([a-zA-Z]{2})(?=[^a-zA-Z0-9]|$)/g;
      let mm;
      while ((mm = re.exec(cs))) {
        if (COUNTRY[mm[1].toUpperCase()]) return { field: 'country', value: mm[1].toUpperCase() };
      }
    }

    // 4) 协议图标：class/src/alt/title 中含独立的协议关键字（icon-https、https.png）
    const tokens = classes.concat(urls, [attr(host, 'alt'), attr(host, 'title')]).join(' ').toLowerCase();
    for (const proto of PROTOCOLS) {
      const re = new RegExp('(?:^|[^a-z0-9])' + proto + '(?=[^a-z0-9]|$)');
      if (re.test(tokens)) return { field: 'protocol', value: proto };
    }

    return null;
  }

  /* ---------------- favicon -> icon_hash ---------------- */

  // FOFA 的 icon_hash = mmh3(base64(favicon 字节))，有符号 32 位
  function mmh3(bytes, seed) {
    const c1 = 0xcc9e2d51, c2 = 0x1b873593;
    let h1 = seed | 0;
    const len = bytes.length;
    const nblocks = len >> 2;
    for (let i = 0; i < nblocks; i++) {
      let k1 = (bytes[i * 4]) | (bytes[i * 4 + 1] << 8) | (bytes[i * 4 + 2] << 16) | (bytes[i * 4 + 3] << 24);
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
      h1 = (h1 << 13) | (h1 >>> 19);
      h1 = (Math.imul(h1, 5) + 0xe6546b64) | 0;
    }
    let k1 = 0;
    const tail = len & 3;
    if (tail === 3) k1 ^= bytes[nblocks * 4 + 2] << 16;
    if (tail >= 2) k1 ^= bytes[nblocks * 4 + 1] << 8;
    if (tail >= 1) {
      k1 ^= bytes[nblocks * 4];
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
    }
    h1 ^= len;
    h1 ^= h1 >>> 16;
    h1 = Math.imul(h1, 0x85ebca6b);
    h1 ^= h1 >>> 13;
    h1 = Math.imul(h1, 0xc2b2ae35);
    h1 ^= h1 >>> 16;
    return h1 | 0;
  }

  function bytesToB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  async function fetchIconBytes(url) {
    try {
      const r = await fetch(url, { credentials: 'omit' });
      if (r.ok) return new Uint8Array(await r.arrayBuffer());
    } catch (e) { /* CORS / 混合内容，走 GM_xmlhttpRequest */ }
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise((resolve) => {
        GM_xmlhttpRequest({
          method: 'GET', url, responseType: 'arraybuffer', timeout: 8000,
          onload: (res) => resolve(res.response ? new Uint8Array(res.response) : null),
          onerror: () => resolve(null),
          ontimeout: () => resolve(null)
        });
      });
    }
    return null;
  }

  // src 是 http(s) 或 data: 图片；返回可用于计算的源
  function faviconCandidate(t) {
    const img = t.closest('img');
    if (!img) return null;
    const src = img.currentSrc || img.src || '';
    if (!src) return null;
    if (/^data:image\/[^;]+;base64,/i.test(src)) return src;
    if (!/^https?:/i.test(src)) return null;
    if (/flag/i.test(src + ' ' + clsOf(img))) return null; // 国旗交给 probeImage
    const small = img.naturalWidth > 0 && img.naturalWidth <= 64;
    const hinted = /favicon|\.ico(\?|#|$)|logo|icon/i.test(src + ' ' + clsOf(img));
    return (small || hinted) ? src : null;
  }

  async function computeIconHash(src) {
    try {
      let b64;
      if (/^data:/i.test(src)) {
        b64 = src.slice(src.indexOf(',') + 1);
      } else {
        const bytes = await fetchIconBytes(src);
        if (!bytes || !bytes.length) return null;
        b64 = bytesToB64(bytes);
      }
      return mmh3(new TextEncoder().encode(b64), 0);
    } catch (e) {
      return null;
    }
  }

  /* ---------------- 右键目标识别 ---------------- */

  function findCandidate(e) {
    const t = e.target;
    if (!(t instanceof Element)) return null;
    if (menu && menu.contains(t)) return null;

    const cur = currentQuery();

    // 1) 带有 qbase64 的 FOFA 搜索链接
    const link = t.closest('a[href*="qbase64="]');
    if (link) {
      const lq = queryFromUrl(link.href);
      if (lq) {
        const cond = stripCurrent(lq, cur);
        if (cond) {
          const base = negate(cond) || `${guessField(link)}="${firstText(link).slice(0, MAX_TEXT_LEN)}"`;
          return { cur, cond: base };
        }
      }
    }

    // 2) 选中的文本（若是国名/协议名则直接映射）
    const sel = window.getSelection ? String(window.getSelection()) : '';
    const st = sel.trim();
    if (st && st.length <= 120) {
      const code = NAME2CODE[st.toLowerCase()];
      if (code) return { cur, cond: `country="${code}"` };
      if (PROTO_SET.has(st.toLowerCase())) return { cur, cond: `protocol="${st.toLowerCase()}"` };
      return { cur, cond: `product="${st}"` };
    }

    // 3) 图片/图标：国旗、协议图标
    const img = probeImage(t);
    if (img) return { cur, cond: `${img.field}="${img.value}"` };

    // 4) favicon -> 异步计算 icon_hash
    const icon = faviconCandidate(t);
    if (icon) return { cur, cond: '', iconSrc: icon };

    // 5) 可点击元素的文本（title/alt 优先；国名/协议名映射）
    const clickable = t.closest(CLICKABLE_SEL);
    if (clickable) {
      const txt = firstText(clickable).slice(0, MAX_TEXT_LEN);
      if (txt) {
        const code = NAME2CODE[txt.toLowerCase()];
        if (code) return { cur, cond: `country="${code}"` };
        if (PROTO_SET.has(txt.toLowerCase())) return { cur, cond: `protocol="${txt.toLowerCase()}"` };
        return { cur, cond: `${guessField(clickable)}="${txt}"` };
      }
    }

    // 6) Vue 实例数据兜底
    const v = vueProbe(t);
    if (v) return { cur, cond: `product="${v}"` };

    return null;
  }

  /* ---------------- 打开 / 复制 ---------------- */

  function openTab(query) {
    const url = `${location.origin}/result?qbase64=${encodeURIComponent(b64enc(query))}`;
    if (typeof GM_openInTab === 'function') {
      GM_openInTab(url, { active: !OPEN_IN_BACKGROUND });
    } else {
      window.open(url, '_blank');
    }
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
#fofa-exclude-menu .fx-status{color:#57606a;font-size:11px;margin-top:4px}
#fofa-exclude-menu .fx-status:empty{display:none}
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
      <input class="fx-cond" spellcheck="false" placeholder='例如 product="HIKVISION-视频监控" 或 icon_hash="123456"'>
      <div class="fx-btns">
        <button class="fx-primary" title="将该条件取反后追加到当前语句，并在新标签页打开">🚫 排除并打开</button>
        <button class="fx-inc" title="将该条件追加到当前语句，并在新标签页打开">➕ 包含</button>
        <button class="fx-copy" title="复制排除后的完整语句">📋</button>
      </div>
      <div class="fx-status"></div>`;

    const input = menu.querySelector('.fx-cond');
    const status = menu.querySelector('.fx-status');
    let edited = false;
    input.value = cand.cond;
    input.addEventListener('input', () => { edited = true; });

    // favicon：菜单弹出后异步计算 icon_hash，成功且用户未编辑时自动填入
    if (cand.iconSrc) {
      status.textContent = '⏳ 正在计算 icon_hash…';
      computeIconHash(cand.iconSrc).then((h) => {
        if (!menu) return;
        if (h === null) {
          status.textContent = '⚠ icon_hash 计算失败（跨域受限），可手动填写条件';
          return;
        }
        status.textContent = `✓ 已识别图标：icon_hash="${h}"`;
        if (!edited && !input.value.trim()) input.value = `icon_hash="${h}"`;
      });
    }

    const getCond = () => input.value.replace(/\s+/g, ' ').trim();
    const compose = (cond) => (cand.cur ? `${cand.cur} && ${cond}` : cond);

    const doOpen = (mode) => {
      const cond = getCond();
      if (!cond) { input.focus(); return; }
      const final = mode === 'include' ? ensurePos(cond) : ensureNeg(cond);
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
    if (!cand) return; // 非组件/链接区域：保持原生右键菜单
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
