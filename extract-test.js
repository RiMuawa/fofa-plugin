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
  const ok = got === want;
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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
