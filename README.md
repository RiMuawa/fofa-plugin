# FOFA 右键排除搜索（Tampermonkey 用户脚本）

在 FOFA 结果页右键各类元素，将该项「包含 / 排除」追加到当前搜索语句，并在新标签页打开。

## 功能

| 右键对象 | 识别来源 |
|---|---|
| 组件 / 产品链接 | 解码链接自身的 qbase64 |
| favicon 图标 | 图标外层自带的 icon_hash 搜索链接 |
| 国旗图片（结果行 / 侧栏统计） | 相邻的 country 搜索链接 |
| 侧栏世界地图上的国家 | 右键时悬停中的地图 tooltip（国家名 / ISO 代码） |
| 侧栏「相关Icon」图标 | Vue 组件数据中的 icon_hash（按图标 base64 匹配条目，精确值） |
| 侧栏各排名条目（分类 / Server / 网站标题 / 证书组织 / 网站指纹 / 协议 / 端口…） | 条目自带链接的 qbase64 |
| 服务器图标 | 图标所在锚点的文本 |
| IP / 端口 / 城市 / ASN / org / domain / header_hash / TLS 版本等链接 | 链接的 qbase64 |
| 划选文本 | 选区内容（国名/协议名自动识别字段） |

- 排除 = 将条件取反后追加到当前语句；菜单内条件可编辑，回车 = 排除并打开
- 「包含」在未编辑时沿用 FOFA 原生运算符（保留 `==` 精确匹配语义）
- **批量操作**：菜单「📥 暂存」把条件攒进右下角徽标（跨页面保留）；或 **Alt + 左键拖拽框选**一块区域，自动识别其中所有可排除对象（侧栏排名条目/结果行 favicon/国旗/服务器图标/相关Icon）并入批量面板，一次「全部排除/包含并打开」；当前语句里已存在的条件在排除时自动就地取反而不是追加
- **指纹收藏库**：右键菜单「⭐」收藏当前搜索语句，自动抓取——独立 IP 数、**产品排名**（第一名+与第一名计数同位数者）、**国家/地区排名**（同规则，如 3000/2000/999 取前两者）、**Server**、**Title**（均取第一名）；左下角「🗂 指纹库」打开管理面板——表格含名称/搜索语句/IP数/产品/国家/Server/Title/厂商/型号/备注列，单元格点击即编辑（失焦保存）、可任意新建/删除条目、🔍 直接用该语句搜索、一键导出 JSON/CSV（CSV 带 BOM，Excel 可直接打开）；数据存于浏览器 localStorage；**fofa.info 首页默认自动打开**（居中偏下，手动关闭后本次会话不再弹出）
- **在本页打开**：菜单页脚的开关，勾选后在当前标签页内跳转（默认新标签）
- **只在识别到上述目标时才接管右键**，其余位置保持浏览器原生菜单；**Shift + 右键** = 强制原生菜单
- 新标签页经 `window.open` 打开，保留 opener 关系——Tree Style Tab 等树状标签插件会将其挂为当前标签的**子标签**
- 页面加载后控制台（F12）会输出 `[FOFA排除搜索] v2.x.x 已加载`，右键无反应时先确认版本号与仓库一致

## 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展；
2. Tampermonkey → 添加新脚本 → 粘贴 `fofa-exclude.user.js` 全文 → `Ctrl+S` 保存；
3. Chrome（Manifest V3）需在 `chrome://extensions` → Tampermonkey → 详情中开启「允许运行用户脚本」。

## 配置

脚本开头的常量：

- `OPEN_IN_BACKGROUND`：`true` 时新标签页在后台打开。注意：后台打开走 `GM_openInTab`，会丢失 opener 树状关系（前台打开才有）。

## 实现说明（基于 FOFA v5.5 实测 DOM）

- 结果页各字段均为 `<a href="/result?qbase64=...">` 链接，解码后剥掉当前语句、把 `=`/`==` 翻成 `!=` 再追加，值与 FOFA 自身搜索完全一致；
- FOFA 组合链接有两种形态：`当前语句 && 新条件`（前缀拼接）与 `(新条件 && 部分当前语句) && 其余`（括号重组，常见于分类/时间过滤），按顶层分段差集 + 括号内递归提取新增条件；运算符支持单等号（模糊）与双等号（精确），字段名支持带点（`cert.subject.org`）；
- favicon（`img.el-image__inner`）外层就是 icon_hash 链接；
- 国旗（`img.hsxa-country-img`）是内联 SVG、alt 固定为 "country"，从相邻 country 链接取值；
- 世界地图是 ECharts canvas（国家非 DOM 元素、无实例句柄），用悬停 tooltip 提取；
- 「相关Icon」无链接，图标数据在 Vue 组件 props（`keyWord="icon_hash"`, `items[]{key, imageBase64}`）里，从挂载容器 `__vue_app__` 沿 vnode 树下钻读取（Nuxt 根下为 Suspense，需走 `suspense.activeBranch`）；Tampermonkey 沙箱下经 `unsafeWindow` 访问页面世界。

## 测试

`node extract-test.js` —— 针对条件提取/取反的单元测试（含真实抓取的括号重组链接样本）。
