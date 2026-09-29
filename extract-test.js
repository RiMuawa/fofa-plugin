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

// ===== 批量应用 applyBatch =====
const applyBatch = eval('(0,' + grabFn('applyBatch').replace('function applyBatch', 'function') + ')');
eq('批量排除-追加', applyBatch('title="web"', ['product="A"', 'country="US"'], 'exclude'),
  'title="web" && product!="A" && country!="US"');
eq('批量排除-已存在就地取反', applyBatch('(category="路由器" && after="2026-08-24") && icon_hash=="-869158581"', ['category="路由器"', 'port="80"'], 'exclude'),
  '(category!="路由器" && after="2026-08-24") && icon_hash=="-869158581" && port!="80"');
eq('批量包含-跳过已存在', applyBatch('title="web"', ['title="web"', 'port="80"'], 'include'),
  'title="web" && port="80"');
eq('批量-无当前语句', applyBatch('', ['product="A"'], 'exclude'), 'product!="A"');

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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
