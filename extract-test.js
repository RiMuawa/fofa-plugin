// 从 fofa-toolbox.user.js 中抠出纯函数做单元测试
const fs = require('fs');
const src = fs.readFileSync('E:/plugins/fofa-toolbox/fofa-toolbox.user.js', 'utf8');

function grabFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('not found: ' + name);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) break; }
  }
  return src.slice(start, i + 1);
}
const negate = eval('(0,' + grabFn('negate').replace('function negate', 'function') + ')');
const splitTop = eval('(0,' + grabFn('splitTop').replace('function splitTop', 'function') + ')');
const extractNew = eval('(0,' + grabFn('extractNew').replace('function extractNew', 'function') + ')');

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const norm = (v) => (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
  const ok = norm(got) === norm(want);
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + ' => ' + JSON.stringify(got) + (ok ? '' : ' (期望 ' + JSON.stringify(want) + ')'));
};

// 用户提供的真实链接（分类排名“路由器”）
const lqUser = Buffer.from('KGNhdGVnb3J5PSLot6/nlLHlmagiICYmIGFmdGVyPSIyMDI2LTA4LTI0IikgJiYgaWNvbl9oYXNoPT0iMTkyNDM1ODQ4NSI=', 'base64').toString('utf8');
console.log('链接解码 =', lqUser, '\n');

const curUser = 'after="2026-08-24" && icon_hash=="1924358485"';
eq('真实案例-提取新条件', extractNew(lqUser, curUser), 'category="路由器"');
eq('真实案例-取反', negate(extractNew(lqUser, curUser)), 'category!="路由器"');
eq('真实案例-cur重排后', extractNew(lqUser, 'icon_hash=="1924358485" && after="2026-08-24"'), 'category="路由器"');

// 回归：干净前缀拼接（此前已验证的场景）
eq('前缀拼接', extractNew('port="443" && server=="cloudflare"', 'port="443"'), 'server=="cloudflare"');
eq('独立条件链接', extractNew('country="DE"', 'title="test"'), 'country="DE"');
eq('单等号取反', negate('fid="0FC01Psf64jTBZwBfHZoDg=="'), 'fid!="0FC01Psf64jTBZwBfHZoDg=="');
eq('双等号取反', negate('title=="301 Moved Permanently"'), 'title!="301 Moved Permanently"');
eq('带点字段取反', negate('cert.subject.org=="Let\'s Encrypt"'), 'cert.subject.org!="Let\'s Encrypt"');

// 不应产生新条件的情况
eq('仅重排=无新增', extractNew('icon_hash=="1" && after="2026-08-24"', curUser.replace('1924358485', '1')), null);
eq('完全相同(分页)', extractNew(curUser, curUser), null);

// ===== 自引用链接（分类排名里当前选中的第一条，2026-09-28 真实样本） =====
const flattenLeaves = eval('(0,' + grabFn('flattenLeaves').replace('function flattenLeaves', 'function') + ')');
const selfCondition = eval('(0,' + grabFn('selfCondition').replace('function selfCondition', 'function') + ')');

// “路由器”链接 == 当前语句本身；其他条目 = 当前语句 && category="X"
const curSelf = 'after="2026-08-24" && icon_hash=="-869158581"';
const lqRouter = '((' + curSelf.replace('after', 'category="路由器" && after') + ') && icon_hash=="-869158581")' +
  ' && icon_hash=="-869158581"';
// 直接用抓包的原字符串更保真：
const lqRouterReal = Buffer.from('KChjYXRlZ29yeT0i6Lev55Sx5ZmoIiAmJiBhZnRlcj0iMjAyNi0wOC0yNCIpICYmIGljb25faGFzaD09Ii04NjkxNTg1ODEiKSAmJiBpY29uX2hhc2g9PSItODY5MTU4NTgxIg==', 'base64').toString('utf8');
const lqAdslReal = Buffer.from('KChjYXRlZ29yeT0i6Lev55Sx5ZmoIiAmJiBhZnRlcj0iMjAyNi0wOC0yNCIpICYmIGljb25faGFzaD09Ii04NjkxNTg1ODEiKSAmJiBpY29uX2hhc2g9PSItODY5MTU4NTgxIiAmJiBjYXRlZ29yeT0iQURTTCI=', 'base64').toString('utf8');
console.log('路由器链接解码 =', lqRouterReal, '\n');
const curReal = lqRouterReal; // 第一条与当前语句完全相同（自引用）

eq('自引用-无新增条件', extractNew(lqRouterReal, curReal), null);
eq('自引用-定位条件', selfCondition(lqRouterReal, '路由器'), 'category="路由器"');
eq('自引用-取反', negate(selfCondition(lqRouterReal, '路由器')), 'category!="路由器"');
eq('自引用-就地替换', curReal.replace(selfCondition(lqRouterReal, '路由器'), 'category!="路由器"'),
  '((category!="路由器" && after="2026-08-24") && icon_hash=="-869158581") && icon_hash=="-869158581"');
eq('自引用-文本不匹配时放弃', selfCondition(lqRouterReal, '不存在的值'), null);
eq('同区块其他条目-ADSL', extractNew(lqAdslReal, curReal), 'category="ADSL"');

// ===== 链接语句与页面语句空格风格差异（组合链接用无空格 &&）=====
eq('空格差异-段仍视为已存在', extractNew('title="x"&&port="80" && country="DE"', 'title="x" && port="80"'), 'country="DE"');
eq('空格差异-无新增', extractNew('title="x"&&port="80"', 'title="x" && port="80"'), null);
const condInQuery = eval('(0,' + grabFn('condInQuery').replace('function condInQuery', 'function') + ')');
eq('条件存在-忽略空白', condInQuery('title="x" && port="80"', 'title="x"&&port="80"'), true);
eq('条件存在-空白无关包含', condInQuery('app="A" && country="PK"', 'country="PK"'), true);
eq('条件不存在', condInQuery('app="A" && port="80"', 'country="PK"'), false);

// ===== 批量应用 applyBatch（含 joinIncludeBatch：同字段多值 || 并列加括号） =====
const joinIncludeBatch = eval('(0,' + grabFn('joinIncludeBatch').replace('function joinIncludeBatch', 'function') + ')');
const applyBatch = eval('(0,' + grabFn('applyBatch').replace('function applyBatch', 'function') + ')');
eq('批量排除-追加', applyBatch('title="web"', ['product="A"', 'country="US"'], 'exclude'),
  'title="web" && product!="A" && country!="US"');
eq('批量排除-已存在就地取反', applyBatch('(category="路由器" && after="2026-08-24") && icon_hash=="-869158581"', ['category="路由器"', 'port="80"'], 'exclude'),
  '(category!="路由器" && after="2026-08-24") && icon_hash=="-869158581" && port!="80"');
eq('批量包含-跳过已存在', applyBatch('title="web"', ['title="web"', 'port="80"'], 'include'),
  'title="web" && port="80"');
eq('批量-无当前语句', applyBatch('', ['product="A"'], 'exclude'), 'product!="A"');

// ===== 包含模式批量拼接：同字段多值用 || 并列加括号（一个字段不可能同时等于多个值） =====
eq('包含拼接-用户示例三条product', applyBatch('title="web"', ['product="A"', 'product="B"', 'product="C"'], 'include'),
  'title="web" && (product="A" || product="B" || product="C")');
eq('包含拼接-不同字段仍用且', applyBatch('', ['product="A"', 'country="CN"', 'product="B"'], 'include'),
  '(product="A" || product="B") && country="CN"');
eq('包含拼接-同值去重', joinIncludeBatch('', ['product="A"', 'product="A"', 'product=="A"']), 'product="A"');
eq('包含拼接-已存在的跳过后成单值不括号', applyBatch('product="A"', ['product="A"', 'product="B"'], 'include'),
  'product="A" && product="B"');
eq('包含拼接-识别不了的条件独立追加', joinIncludeBatch('title="x"', ['(a="1" || b="2")', 'port="80"']),
  '(a="1" || b="2") && port="80"');
eq('包含拼接-混合字段各自分组', applyBatch('', ['country="PK"', 'product="X"', 'country="IN"', 'server="nginx"'], 'include'),
  '(country="PK" || country="IN") && product="X" && server="nginx"');
eq('包含拼接-全空', joinIncludeBatch('a="1"', []), '');

// ===== 指纹库 CSV 导出 =====
const csvMatch = /const csvCell = ([^;]+);/.exec(src);
if (!csvMatch) throw new Error('csvCell not found');
const csvCell = eval('(' + csvMatch[1] + ')');
const libToCsv = eval('(0,' + grabFn('libToCsv').replace('function libToCsv', 'function') + ')');
eq('CSV-引号转义', csvCell('a"b'), '"a""b"');
eq('CSV-null转空', csvCell(null), '""');

// ===== 指纹库自动抓取：第一名 + 同位数规则 =====
const pickTopSameDigits = eval('(0,' + grabFn('pickTopSameDigits').replace('function pickTopSameDigits', 'function') + ')');
eq('同位数-用户示例', pickTopSameDigits([{ name: '美国', count: '3000' }, { name: '中国', count: '2000' }, { name: '印度', count: '999' }]), ['美国', '中国']);
eq('同位数-千分位', pickTopSameDigits([{ name: 'A', count: '16,573,129' }, { name: 'B', count: '14,699,263' }, { name: 'C', count: '999,999' }]), ['A', 'B']);
eq('同位数-仅第一名', pickTopSameDigits([{ name: 'X', count: '500' }]), ['X']);
eq('同位数-空', pickTopSameDigits([]), []);
eq('同位数-计数不可见', pickTopSameDigits([{ name: 'X', count: '*' }, { name: 'Y', count: '*' }]), ['X']);

// ===== app= / product= 同义识别 =====
const productFromQuery = eval('(0,' + grabFn('productFromQuery').replace('function productFromQuery', 'function') + ')');
eq('app取产品', productFromQuery('app="HIKVISION-视频监控" && after="2026-08-24"'), 'HIKVISION-视频监控');
eq('product取产品', productFromQuery('title="test" && product=="Apache"'), 'Apache');
eq('app双等号', productFromQuery('(app=="Tengine") && port="443"'), 'Tengine');
eq('无产品条件', productFromQuery('title="web" && country="CN"'), '');
eq('title值内含app=不误判', productFromQuery('title="use app=here"'), '');

// ===== after= 识别 / 名称填写规则 =====
const afterFromQuery = eval('(0,' + grabFn('afterFromQuery').replace('function afterFromQuery', 'function') + ')');
eq('after识别', afterFromQuery('after="2026-08-24" && category="视频监控"'), '2026-08-24');
eq('after在组合中', afterFromQuery('(app="Tengine") && after=="2026-09-01"'), '2026-09-01');
eq('after无则空', afterFromQuery('app="Tengine"'), '');
const pickName = eval('(0,' + grabFn('pickName').replace('function pickName', 'function') + ')');
eq('名称-语句单产品', pickName('Tengine', [{ name: 'A', count: '1' }]), 'Tengine');
eq('名称-排名仅一条', pickName('', [{ name: '唯一', count: '500' }]), '唯一');
eq('名称-第一名独一档', pickName('', [{ name: '甲', count: '9000' }, { name: '乙', count: '900' }, { name: '丙', count: '80' }]), '甲');
eq('名称-并列则留空', pickName('', [{ name: '甲', count: '3000' }, { name: '乙', count: '2000' }]), '');
eq('名称-全无线索留空', pickName('', []), '');

// ===== 置顶指纹与日期替换 =====
const afterReSrc = /const AFTER_VAL_RE = ([^;]+);/.exec(src)[1];
const resolveQuery = eval('(function(){const AFTER_VAL_RE = ' + afterReSrc + ';' + grabFn('fmtDate') + '\n' + grabFn('monthAgoOf') + '\n' + grabFn('substituteBuiltinSyntax') + '\n' + grabFn('resolveQuery') + '\nreturn resolveQuery;})()');
const sep29 = new Date(2026, 8, 29); // 2026-09-29（用户示例的“今天”）
eq('置顶-昨天替换', resolveQuery('after="YESTERDAY" && protocol="telnet" && "busybox"', false, sep29),
  'after="2026-09-28" && protocol="telnet" && "busybox"');
eq('置顶-一月前', resolveQuery('after="YESTERDAY" && protocol="telnet" && "busybox"', true, sep29),
  'after="2026-08-29" && protocol="telnet" && "busybox"');
eq('普通语句-一月前', resolveQuery('after="2026-09-28" && app="Tengine"', true, sep29), 'after="2026-08-29" && app="Tengine"');
eq('普通语句-原样', resolveQuery('after="2026-09-28" && app="Tengine"', false, sep29), 'after="2026-09-28" && app="Tengine"');
eq('月末钳制', resolveQuery('after="2026-03-31"', true, new Date(2026, 2, 31)), 'after="2026-02-28"');
eq('无after-一月前不变', resolveQuery('app="Tengine" && title="x"', true, sep29), 'app="Tengine" && title="x"');

// ===== 内置语法：LastMonth / 作用域限定 =====
const hasBuiltinSyntax = eval('(function(){const AFTER_VAL_RE = ' + afterReSrc + ';' + grabFn('hasBuiltinSyntax') + '\nreturn hasBuiltinSyntax;})()');
eq('LastMonth替换', resolveQuery('after="LastMonth" && protocol="telnet"', false, sep29), 'after="2026-08-29" && protocol="telnet"');
eq('大小写不敏感', resolveQuery('after="lastmonth"', false, sep29), 'after="2026-08-29"');
eq('仅after内替换', resolveQuery('title="YESTERDAY news" && after="YESTERDAY"', false, sep29), 'title="YESTERDAY news" && after="2026-09-28"');
eq('检测-内置语法', hasBuiltinSyntax('after="LastMonth" && app="X"'), true);
eq('检测-普通语句', hasBuiltinSyntax('after="2026-09-28" && app="X"'), false);
eq('检测-文本不含', hasBuiltinSyntax('title="yesterday"'), false);

// ===== 导入：CSV/JSON 解析 + 去重合并 =====
const LIB_FIELDS_SRC = /const LIB_FIELDS = (\[[\s\S]*?\]);/.exec(src)[1];
const parseImportJson = eval('(0,' + grabFn('parseImportJson').replace('function parseImportJson', 'function') + ')');
const parseImportCsv = eval('(function(){const LIB_FIELDS = ' + LIB_FIELDS_SRC + ';' + grabFn('parseImportCsv') + '\nreturn parseImportCsv;})()');
const parseImport = eval('(function(){const LIB_FIELDS = ' + LIB_FIELDS_SRC + ';' + grabFn('parseImportJson') + '\n' + grabFn('parseImportCsv') + '\n' + grabFn('parseImport') + '\nreturn parseImport;})()');
const mergeImport = eval('(function(){const LIB_FIELDS = ' + LIB_FIELDS_SRC + ';' + grabFn('mergeImport') + '\nreturn mergeImport;})()');
// libToCsv 依赖 LIB_FIELDS 与 csvCell，原绑定缺这两个作用域（此前未被调用故未暴露）
const libToCsvFull = eval('(function(){const LIB_FIELDS = ' + LIB_FIELDS_SRC + ';const csvCell = ' + csvMatch[1] + ';' + grabFn('libToCsv') + '\nreturn libToCsv;})()');

// CSV 往返：libToCsv 导出再导入，字段一致（含引号内逗号/双引号/换行/BOM/CRLF）
const csvSample = [
  { id: 1, name: '路由器', query: 'category="路由器" && after="YESTERDAY"', ip: '1234', product: 'A', category: '路由器', region: '美国、中国', server: 'nginx', title: 't,1', after: 'YESTERDAY', vendor: 'v', model: 'm', note: 'he said "hi"', ts: '2026/9/29 10:00:00' },
  { id: 2, name: '多行', query: 'title="multi\nline"', ip: '', product: '', category: '', region: '', server: '', title: 'multi\nline', after: '', vendor: '', model: '', note: '', ts: '2026/9/29 11:00:00' }
];
const csvBack = parseImportCsv(libToCsvFull(csvSample));
eq('导入CSV-往返条数', csvBack.length, 2);
eq('导入CSV-名称还原', csvBack[0].name, '路由器');
eq('导入CSV-语句还原', csvBack[0].query, 'category="路由器" && after="YESTERDAY"');
eq('导入CSV-引号内逗号', csvBack[0].title, 't,1');
eq('导入CSV-引号内双引号', csvBack[0].note, 'he said "hi"');
eq('导入CSV-引号内换行', csvBack[1].title, 'multi\nline');
eq('导入CSV-收藏时间', csvBack[0].ts, '2026/9/29 10:00:00');
eq('导入CSV-空行跳过', parseImportCsv('名称,搜索语句\r\n\r\nx,app="A"\r\n').length, 1);
eq('导入CSV-英文表头', parseImportCsv('name,query\nx,app="A"')[0].query, 'app="A"');
eq('导入CSV-缺语句列报错', (function () { try { parseImportCsv('name,ip\nx,1'); return false; } catch (e) { return true; } })(), true);
eq('导入JSON-数组', parseImport('[{"query":"app=\\"A\\"","name":"x"}]', 'a.json').length, 1);
eq('导入JSON-BOM嗅探', parseImport('\ufeff[{"query":"q"}]', '').length, 1);
eq('导入JSON-items包装', parseImportJson('{"items":[{"query":"q"}]}').length, 1);
eq('导入JSON-非数组报错', (function () { try { parseImportJson('{"a":1}'); return false; } catch (e) { return true; } })(), true);

// 合并：按语句去重（忽略空白差异）、无语句跳过、整行空白忽略、id 冲突重分配
const r1 = mergeImport([
  { name: 'dup', query: 'app="A"', pin: true },
  { name: 'new', query: 'app="B"', ts: 't' },
  { name: 'dup2', query: 'app = "B"' },
  { name: 'noq', query: '', ip: '99' },
  { name: '', query: '', note: '' }
], [{ id: 9, name: 'e', query: 'app="A"', ts: 'x' }]);
eq('导入合并-新增', r1.added, 1);
eq('导入合并-跳过', r1.skipped, 3);
eq('导入合并-总条数', r1.list.length, 2);
eq('导入合并-保留原条目', r1.list[0].name, 'e');
eq('导入合并-新增字段', r1.list[1].query, 'app="B"');
const r2 = mergeImport([{ query: 'app="C"', pin: true, id: 9 }], [{ id: 9, query: 'app="Z"' }]);
eq('导入合并-保留置顶', r2.list[1].pin, true);
eq('导入合并-id冲突重分配', r2.list[1].id !== 9, true);
eq('导入合并-整行空白不计跳过', mergeImport([{ query: '', note: '' }], []).skipped, 0);

// ===== 查询编辑器：语句 <-> 字段卡 =====
const splitOrTop = eval('(0,' + grabFn('splitOrTop').replace('function splitOrTop', 'function') + ')');
const stripWrapParens = eval('(0,' + grabFn('stripWrapParens').replace('function stripWrapParens', 'function') + ')');
const balanceParens = eval('(0,' + grabFn('balanceParens').replace('function balanceParens', 'function') + ')');
const parseCondOne = eval('(0,' + grabFn('parseCondOne').replace('function parseCondOne', 'function') + ')');
const parseQueryToCards = eval('(function(){' + grabFn('splitTop') + '\n' + grabFn('splitOrTop') + '\n' + grabFn('stripWrapParens') + '\n' + grabFn('balanceParens') + '\n' + grabFn('parseCondOne') + '\n' + grabFn('parseQueryToCards') + '\nreturn parseQueryToCards;})()');
const cardsToQuery = eval('(function(){' + grabFn('cardRowQ') + '\n' + grabFn('cardsToQuery') + '\nreturn cardsToQuery;})()');
const mergeCards = eval('(0,' + grabFn('mergeCards').replace('function mergeCards', 'function') + ')');

eq('或切分', splitOrTop('country="PK" || country="IN" || country="IR"').length, 3);
eq('或切分-括号内不切', splitOrTop('(a="1" || b="2") && c="3"').length, 1);
eq('剥外层括号', stripWrapParens('(country="PK" || country="IN")'), 'country="PK" || country="IN"');
eq('剥外层括号-迭代多层', stripWrapParens('((country="PK"))'), 'country="PK"');
eq('不剥中途闭合', stripWrapParens('(a="1") || b="2"'), '(a="1") || b="2"');
eq('不剥引号内括号', stripWrapParens('(title="a(b)" || c="1")'), 'title="a(b)" || c="1"');
eq('条件-双等号', JSON.stringify(parseCondOne('icon_hash=="-1940193079"')), JSON.stringify({ field: 'icon_hash', op: '==', value: '-1940193079' }));
eq('条件-排除', JSON.stringify(parseCondOne('server!="nginx"')), JSON.stringify({ field: 'server', op: '!=', value: 'nginx' }));
eq('条件-不带引号值', JSON.stringify(parseCondOne('port=80')), JSON.stringify({ field: 'port', op: '=', value: '80' }));
eq('条件-裸关键词', JSON.stringify(parseCondOne('"busybox"')), JSON.stringify({ field: '', op: '', value: 'busybox' }));
eq('条件-识别失败', parseCondOne('(a && b)'), null);

// 用户示例规则：双层括号或组 + 排除链 + 常规条件
const oemTail = 'is_cloud="false" && category="视频监控" && product!="HIKVISION-视频监控" && product!="LOREX-视频监控" && after="2026-09-08"';
const userQ = '((country="PK" || country="IN" || country="IR" || country="KZ")) && ' + oemTail;
const cards = parseQueryToCards(userQ);
eq('字段卡-卡数', cards.length, 5);
eq('字段卡-country是或卡', cards[0].join, '||');
eq('字段卡-country行数', cards[0].rows.length, 4);
eq('字段卡-product排除并成一卡', (cards.filter((c) => c.field === 'product')[0] || {}).rows.length, 2);
eq('字段卡-product是且卡', (cards.filter((c) => c.field === 'product')[0] || {}).join, '&&');
eq('字段卡-用户规则往返（双层括号规范化为单层）', cardsToQuery(cards),
  '(country="PK" || country="IN" || country="IR" || country="KZ") && ' + oemTail);
eq('字段卡-同字段且卡或卡并存', cardsToQuery(parseQueryToCards('(country="PK" || country="IN") && country!="CN"')),
  '(country="PK" || country="IN") && country!="CN"');
eq('字段卡-关键词往返', cardsToQuery(parseQueryToCards('"busybox" && protocol="telnet"')), '"busybox" && protocol="telnet"');
eq('字段卡-跨字段或组原样保留', cardsToQuery(parseQueryToCards('(app="A" && port="1") || title="x"')), '(app="A" && port="1") || title="x"');
eq('字段卡-空语句', cardsToQuery(parseQueryToCards('')), '');

// 整段被括号包裹的 && 链（用户示例：((country组) && after && is_cloud)，尾部还有空格）
const wrappedQ = '((country="PK" || country="IN" || country="IR" || country="KZ" || country="UZ" || country="KG" || country="TJ" || country="TM" || country="AF" || country="PK") && after="2026-08-29" && is_cloud="false" )';
const wrappedCards = parseQueryToCards(wrappedQ);
eq('字段卡-包裹链拆成三卡', wrappedCards.length, 3);
eq('字段卡-包裹链country是或卡', wrappedCards[0].join, '||');
eq('字段卡-包裹链country行数', wrappedCards[0].rows.length, 10);
eq('字段卡-包裹链往返', cardsToQuery(wrappedCards),
  '(country="PK" || country="IN" || country="IR" || country="KZ" || country="UZ" || country="KG" || country="TJ" || country="TM" || country="AF" || country="PK") && after="2026-08-29" && is_cloud="false"');
eq('字段卡-多层包裹单条件', cardsToQuery(parseQueryToCards('(((title="x"))) && port="80"')), 'title="x" && port="80"');

// ===== 括号不配对容错（FOFA 生成的真实语句可能缺/多右括号，实测样例） =====
eq('补括号-缺右括号补在末尾', balanceParens('((a="1" && b="2")'), '((a="1" && b="2"))');
eq('补括号-缺两个', balanceParens('(((a="1"'), '(((a="1")))');
eq('补括号-已配对不动', balanceParens('(a="1") && b="2"'), '(a="1") && b="2"');
eq('补括号-引号内括号不计数', balanceParens('(title="a(b"'), '(title="a(b")');
eq('补括号-多余右括号丢弃', balanceParens('a="1") && b="2"'), 'a="1" && b="2"');
eq('补括号-引号内右括号不丢', balanceParens('title="a)b"'), 'title="a)b"');
eq('容错-多余右括号不再整句塌缩', cardsToQuery(parseQueryToCards('(country="PK" || country="IN")) && title="x"')),
  '(country="PK" || country="IN") && title="x"');

// 用户报告的完整语句（原样粘贴）：多层括号包裹头部 + 排除链 + 分类定位
const userOemQ = '(((country="PK" || country="IN" || country="IR" || country="KZ" || country="UZ" || country="KG" || country="TJ" || country="TM" || country="AF" || country="PK") && after="2026-08-29" && is_cloud="false")) && product!="AUTOMATTIC-WordPress" && product!="HUAWEI-Home-Gateway" && product!="CISCO-Switch" && product!="roundcube" && product!="cPanel-管理产品" && server!="CPE-SERVER/1.0 Supports only GET" && server!="nginx" && server!="LiteSpeed" && server!="CK6u06Vu4" && server!="Apache" && server!="Microsoft-IIS/10.0" && server!="WebServer/1.0 UPnP/1.0" && server!="gSOAP/2.7" && category="其他网络设备"';
const userOemCards = parseQueryToCards(userOemQ);
eq('容错-用户原句卡数', userOemCards.length, 6);
eq('容错-用户原句country是或卡', userOemCards[0].join, '||');
eq('容错-用户原句country行数', userOemCards[0].rows.length, 10);
eq('容错-用户原句product排除并成一卡', (userOemCards.filter((c) => c.field === 'product')[0] || {}).rows.length, 5);
eq('容错-用户原句server排除并成一卡', (userOemCards.filter((c) => c.field === 'server')[0] || {}).rows.length, 8);
eq('容错-用户原句无原样卡', userOemCards.some((c) => c.raw != null), false);
eq('容错-用户原句往返', cardsToQuery(userOemCards),
  '(country="PK" || country="IN" || country="IR" || country="KZ" || country="UZ" || country="KG" || country="TJ" || country="TM" || country="AF" || country="PK") && after="2026-08-29" && is_cloud="false" && product!="AUTOMATTIC-WordPress" && product!="HUAWEI-Home-Gateway" && product!="CISCO-Switch" && product!="roundcube" && product!="cPanel-管理产品" && server!="CPE-SERVER/1.0 Supports only GET" && server!="nginx" && server!="LiteSpeed" && server!="CK6u06Vu4" && server!="Apache" && server!="Microsoft-IIS/10.0" && server!="WebServer/1.0 UPnP/1.0" && server!="gSOAP/2.7" && category="其他网络设备"');

// 同一语句缺一个右括号（URL 里的真实形态）：此前整句塌缩成一张原样卡
const userOemUnbal = '((((country="PK" || country="IN" || country="IR" || country="KZ" || country="UZ" || country="KG" || country="TJ" || country="TM" || country="AF" || country="PK") && after="2026-08-29" && is_cloud="false")) && product!="WordPress" && category="其他网络设备"';
const unbalCards = parseQueryToCards(userOemUnbal);
eq('容错-缺右括号不再整句塌缩', unbalCards.some((c) => c.raw != null), false);
eq('容错-缺右括号拆出或卡', (unbalCards.filter((c) => c.field === 'country')[0] || {}).join, '||');

// ===== 右键菜单：或包含（||）合成 =====
const orCompose = eval('(function(){' + grabFn('parseCondOne') + '\n' + grabFn('splitTop') + '\n' + grabFn('splitOrTop') + '\n' + grabFn('stripWrapParens') + '\n' + grabFn('balanceParens') + '\n' + grabFn('parseQueryToCards') + '\n' + grabFn('cardRowQ') + '\n' + grabFn('cardsToQuery') + '\n' + grabFn('orCompose') + '\nreturn orCompose;})()');
const orCur = '(country="IN" || country="IR" || country="KZ" || country="UZ" || country="KG" || country="TJ" || country="TM" || country="AF" || country="PK" || country="TR") && after="2026-09-10" && is_cloud="false"';
eq('或包含-并入同字段或组（用户示例）', orCompose(orCur, 'country="AZ"'),
  '(country="IN" || country="IR" || country="KZ" || country="UZ" || country="KG" || country="TJ" || country="TM" || country="AF" || country="PK" || country="TR" || country="AZ") && after="2026-09-10" && is_cloud="false"');
eq('或包含-组内已有该值不重复添加', orCompose(orCur, 'country="PK"'), orCur);
eq('或包含-保留==运算符', orCompose('(icon_hash=="1" || icon_hash=="2") && title="x"', 'icon_hash=="3"'),
  '(icon_hash=="1" || icon_hash=="2" || icon_hash=="3") && title="x"');
eq('或包含-整句即或组', orCompose('country="A" || country="B"', 'country="C"'), '(country="A" || country="B" || country="C")');
eq('或包含-无同字段或组整句括起', orCompose('title="x" && port="80"', 'country="PK"'),
  '(title="x" && port="80") || country="PK"');
eq('或包含-跨字段或组不硬并', orCompose('(country="PK" || title="x") && after="2026-09-10"', 'country="IN"'),
  '((country="PK" || title="x") && after="2026-09-10") || country="IN"');
eq('或包含-裸词走整句括起', orCompose('title="x"', '"busybox"'), '(title="x") || "busybox"');
eq('或包含-空语句直接返回条件', orCompose('', 'country="PK"'), 'country="PK"');
eq('或包含-不可解析条件整句括起', orCompose('title="x"', '(a && b)'), '(title="x") || (a && b)');

// ===== 语句框点击 <-> 卡片高亮：cardTextSpans 位置映射 =====
const scanLeaves = eval('(function(){' + grabFn('balanceParens') + '\n' + grabFn('parseCondOne') + '\n' + grabFn('scanLeaves') + '\nreturn scanLeaves;})()');
const cardTextSpans = eval('(function(){' + grabFn('balanceParens') + '\n' + grabFn('parseCondOne') + '\n' + grabFn('scanLeaves') + '\n' + grabFn('cardTextSpans') + '\nreturn cardTextSpans;})()');

const spanQ = '(country="IN" || country="IR" || country="KZ") && after="2026-09-10" && is_cloud="false" && product!="WordPress" && product!="cPanel"';
const spanCards = parseQueryToCards(spanQ);
const spans = cardTextSpans(spanCards, spanQ);
eq('定位-每张卡都有区间', spanCards.map((c, ci) => spans.spanOfCard(ci) != null), spanCards.map(() => true));
eq('定位-或卡区间是整组', spanQ.slice(spans.spanOfCard(0).start, spans.spanOfCard(0).end), '(country="IN" || country="IR" || country="KZ")');
eq('定位-排除卡区间并集', spanQ.slice(spans.spanOfCard(3).start, spans.spanOfCard(3).end), 'product!="WordPress" && product!="cPanel"');
eq('定位-点击或组第二项', JSON.stringify(spans.leafAt(spanQ.indexOf('country="IR"'))), JSON.stringify({ ci: 0, ri: 1 }));
eq('定位-点击is_cloud', JSON.stringify(spans.leafAt(spanQ.indexOf('is_cloud'))), JSON.stringify({ ci: 2, ri: 0 }));
eq('定位-点击排除值', JSON.stringify(spans.leafAt(spanQ.indexOf('cPanel'))), JSON.stringify({ ci: 3, ri: 1 }));
eq('定位-点击组首括号也命中', spans.leafAt(0) != null, true);
eq('定位-点在连接符空隙为null', spans.leafAt(spanQ.indexOf('&& is_cloud')), null);
// 大而真实的语句：所有卡/行都能定位（含原样片段的语句另行覆盖）
const spanOem = cardTextSpans(userOemCards, userOemQ);
eq('定位-用户原句全卡可定位', userOemCards.map((c, ci) => spanOem.spanOfCard(ci) != null), userOemCards.map(() => true));
// 原样片段：跨字段或组是 raw 卡，点击其内部定位到该卡（ri=-1）
const rawQ = '(app="A" || title="x") && port="80"';
const rawCards = parseQueryToCards(rawQ);
const rawSpans = cardTextSpans(rawCards, rawQ);
eq('定位-原样卡区间', rawQ.slice(rawSpans.spanOfCard(0).start, rawSpans.spanOfCard(0).end), '(app="A" || title="x")');
eq('定位-点击原样内部', JSON.stringify(rawSpans.leafAt(rawQ.indexOf('title="x"'))), JSON.stringify({ ci: 0, ri: -1 }));
// 用户在语句框里手打的文本（未规范化）同样能定位
const typedQ = '(country="PK"||country="IN")&&after="2026-09-01"';
const typedSpans = cardTextSpans(parseQueryToCards(typedQ), typedQ);
eq('定位-手打文本点击', JSON.stringify(typedSpans.leafAt(typedQ.indexOf('country="IN"'))), JSON.stringify({ ci: 0, ri: 1 }));

// ===== 快速编辑：删除字段 =====
const dropFieldQuery = eval('(function(){' + grabFn('splitTop') + '\n' + grabFn('splitOrTop') + '\n' + grabFn('stripWrapParens') + '\n' + grabFn('balanceParens') + '\n' + grabFn('parseCondOne') + '\n' + grabFn('parseQueryToCards') + '\n' + grabFn('cardRowQ') + '\n' + grabFn('cardsToQuery') + '\n' + grabFn('dropFieldQuery') + '\nreturn dropFieldQuery;})()');
eq('删字段-或组整组删除', dropFieldQuery('(country="IN" || country="IR") && after="2026-09-10"', 'country'), 'after="2026-09-10"');
eq('删字段-单条与排除都删', dropFieldQuery('country="CN" && title="x" && country!="US"', 'country'), 'title="x"');
eq('删字段-其他字段不动', dropFieldQuery('title="x" && port="80"', 'country'), 'title="x" && port="80"');
eq('删字段-原样片段保留', dropFieldQuery('(country="PK" || title="x") && port="80"', 'country'), '(country="PK" || title="x") && port="80"');
eq('删字段-region不是country', dropFieldQuery('region="Xinjiang" && title="x"', 'country'), 'region="Xinjiang" && title="x"');

// ===== 分组排序（指纹库文件夹 / 预设分组共用） =====
const groupList = eval('(0,' + grabFn('groupList').replace('function groupList', 'function') + ')');
eq('分组-空组排最后', groupList([{ g: 'B' }, { g: '' }, { g: 'A' }], (x) => x.g).map((x) => x.group), ['A', 'B', '']);
eq('分组-组内保持原顺序', groupList([{ g: 'A', i: 1 }, { g: 'B', i: 2 }, { g: 'A', i: 3 }], (x) => x.g)[0].items.map((x) => x.i), [1, 3]);

// ===== 文件夹视图判定（''=全部 '*'=未归档 其他=指定文件夹） =====
const inFolderView = eval('(0,' + grabFn('inFolderView').replace('function inFolderView', 'function') + ')');
eq('文件夹视图-全部', [inFolderView({ folder: 'A' }, ''), inFolderView({ folder: '' }, ''), inFolderView({}, '')], [true, true, true]);
eq('文件夹视图-未归档', [inFolderView({ folder: 'A' }, '*'), inFolderView({ folder: '' }, '*'), inFolderView({ folder: ' ' }, '*')], [false, true, true]);
eq('文件夹视图-指定', [inFolderView({ folder: 'A' }, 'A'), inFolderView({ folder: 'B' }, 'A'), inFolderView({ folder: 'a' }, 'A')], [true, false, false]);

// ===== 预设导入合并 =====
const mergePresets = eval('(0,' + grabFn('mergePresets').replace('function mergePresets', 'function') + ')');
const mp = mergePresets([
  { name: '地区', content: 'country="PK"', group: 'A' },
  { name: '地区', content: 'country="PK"' },
  { name: '', content: '' }
], [{ id: 1, name: 'x', content: 'title="t"' }]);
eq('预设导入-新增', mp.added, 1);
eq('预设导入-重复与空跳过', mp.skipped, 2);
eq('预设导入-分组保留', mp.list[1].group, 'A');
const mp2 = mergePresets([{ name: 'n', content: 'c', id: 1 }], [{ id: 1, name: 'z', content: 'w' }]);
eq('预设导入-id冲突重分配', mp2.list[1].id !== 1, true);
eq('预设导入-空白差异不算重复', mergePresets([{ name: 'a', content: 'x="1"  && y="2"' }], [{ name: 'a', content: 'x="1" && y="2"' }]).skipped, 1);

// 预设并入：同字段同拼接方式的卡合并去重，异拼接另起新卡
eq('预设并入-合并去重', JSON.stringify(mergeCards(
  [{ field: 'country', join: '||', rows: [{ op: '=', value: 'PK' }, { op: '=', value: 'IN' }] }],
  parseQueryToCards('country="IN" || country="UZ"'))),
  JSON.stringify([{ field: 'country', join: '||', rows: [{ op: '=', value: 'PK' }, { op: '=', value: 'IN' }, { op: '=', value: 'UZ' }] }]));
eq('预设并入-拼接不同另起卡', JSON.stringify(mergeCards(
  [{ field: 'country', join: '||', rows: [{ op: '=', value: 'PK' }] }],
  parseQueryToCards('country="CN"')).map((c) => c.field + ':' + c.join)),
  JSON.stringify(['country:||', 'country:&&']));

// ===== 知识库：记录归一化 =====
const kbNormEntry = eval('(0,' + grabFn('kbNormEntry').replace('function kbNormEntry', 'function') + ')');
eq('知识库-归一化字段', JSON.stringify(kbNormEntry({ parent: ' 大华 ', name: 'X', images: ['data:image/jpeg;base64,AAA', 'http://evil/x.png', 42] })),
  JSON.stringify({ parent: '大华', name: 'X', server: '', title: '', note: '', folder: '', images: ['data:image/jpeg;base64,AAA'], ts: '' }));
eq('知识库-空记录剔除', kbNormEntry({ images: [] }), null);
eq('知识库-非对象剔除', kbNormEntry(null), null);
eq('知识库-仅备注保留', kbNormEntry({ note: 'n' }).note, 'n');
eq('知识库-order数字保留', kbNormEntry({ name: 'X', order: 3 }).order, 3);
eq('知识库-order非法丢弃', 'order' in kbNormEntry({ name: 'X', order: 'abc' }), false);

// ===== 指纹库语句去重瘦身 =====
const dedupeQuery = eval('(function(){' + grabFn('splitTop') + '\n' + grabFn('splitOrTop') + '\n' + grabFn('stripWrapParens') + '\n' + grabFn('balanceParens') + '\n' + grabFn('parseCondOne') + '\n' + grabFn('parseQueryToCards') + '\n' + grabFn('cardRowQ') + '\n' + grabFn('cardsToQuery') + '\n' + grabFn('dedupeQuery') + '\nreturn dedupeQuery;})()');
const messyQ = '((country="PK" || country="IN" || country="IR" || country="KZ" || country="UZ" || country="KG" || country="TJ" || country="TM" || country="AF" || country="PK") && after="2026-08-29" && is_cloud="false" ) && category = "视频监控" && product!="AUTOMATTIC-WordPress" && product!="HIKVISION-视频监控" && product!="Dahua-NVR" && product!="FORTINET-防火墙" && product!="uniview-视频监控" && product!="视频监控" && product!="ZTE-公司产品" && product!="netis-ADSL-Modem-Router" && product="NOKIA-Fiber-ONT"';
eq('去重-用户示例', dedupeQuery(messyQ),
  '(country="PK" || country="IN" || country="IR" || country="KZ" || country="UZ" || country="KG" || country="TJ" || country="TM" || country="AF" || country="PK") && after="2026-08-29" && is_cloud="false" && product="NOKIA-Fiber-ONT"');
eq('去重-纯排除卡保留并去重复行', dedupeQuery('product!="A" && product!="A" && product!="B" && country="CN"'), 'product!="A" && product!="B" && country="CN"');
eq('去重-无product定位时category保留', dedupeQuery('category="视频监控" && title="NVR login" && product!="X"'), 'category="视频监控" && title="NVR login" && product!="X"');
eq('去重-同字段多条包含条件保留最后', dedupeQuery('product="A" && product="B"'), 'product="B"');
eq('去重-未知值占位丢弃', dedupeQuery('server="-" && title="x"'), 'title="x"');
eq('去重-干净语句不变', dedupeQuery('title="x" && port="80"'), 'title="x" && port="80"');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
