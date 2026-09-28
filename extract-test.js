// 从 fofa-exclude.user.js 中抠出纯函数做单元测试
const fs = require('fs');
const src = fs.readFileSync('E:/plugins/fofa-exclude/fofa-exclude.user.js', 'utf8');

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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
