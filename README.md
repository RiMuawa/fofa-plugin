# FOFA 右键排除搜索（Tampermonkey 用户脚本）

在 FOFA 结果页右键各类元素，将该项「包含 / 排除」追加到当前搜索语句，并在新标签页打开。

## 功能

| 右键对象 | 生成的条件示例 | 来源 |
|---|---|---|
| 组件 / 产品链接 | `product!="HIKVISION-视频监控"` | 解码链接自身的 qbase64，值与点击该组件搜索的完全一致 |
| favicon 图标 | `icon_hash!="-1940193079"` | FOFA 在图标外层自带 icon_hash 搜索链接，精确值 |
| 国旗图片（结果行 / 侧栏统计） | `country!="DE"` | 就近取同一行/统计项里 FOFA 自带的 country 搜索链接 |
| 侧栏世界地图上的国家 | `country!="CA"` | 右键时读取当前悬停的地图 tooltip（如“加拿大 : 9233”或"NO : 0"） |
| 侧栏各排名条目（分类排名 / Server / 网站标题 / 证书组织 / 网站指纹 fid / 协议 / 端口…） | `server!="cloudflare"`、`cert.subject.org!="Let's Encrypt"` 等 | 解码条目自带链接的 qbase64；同时支持单等号（模糊）与双等号（精确 `==`）及带点字段名 |
| 服务器图标 | `server="nginx"` | 图标所在锚点的文本 |
| IP / 端口 / 城市 / ASN / org / domain / header_hash / TLS 版本等链接 | `port!="443"` 等 | 同组件链接，解码 qbase64 |
| 划选文本 | `product!="选中文本"`（国名/协议名自动识别字段） | 选区 |

- 排除 = 将条件取反后追加：`当前语句 && product!="X"`
- 菜单内条件可编辑，回车 = 排除并打开；「包含」在未编辑时沿用 FOFA 原生运算符（保留 `==` 精确匹配语义）
- **只在识别到上述目标时才接管右键**，其余位置保持浏览器原生菜单
- **Shift + 右键** = 任何时候强制使用原生菜单
- 页面加载后控制台（F12）会输出 `[FOFA排除搜索] v2.x.x 已加载`，右键无反应时先确认版本号与仓库一致

## 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展；
2. Tampermonkey → 添加新脚本 → 粘贴 `fofa-exclude.user.js` 全文 → `Ctrl+S` 保存；
3. Chrome（Manifest V3）需在 `chrome://extensions` → Tampermonkey → 详情中开启「允许运行用户脚本」。

## 配置

脚本开头的常量：

- `OPEN_IN_BACKGROUND`：`true` 时新标签页在后台打开（便于连续排除多项）。

## 实现说明（基于 FOFA v5.5.11 实测 DOM）

- FOFA 结果页各字段均为 `<a href="/result?qbase64=当前语句 && 字段=值">`，脚本解码后剥掉当前语句前缀、把 `=` 翻成 `!=` 再追加，因此值永远与 FOFA 自身搜索一致；
- favicon（`img.el-image__inner`）外层就是 icon_hash 链接，无需自行计算 hash；
- 国旗（`img.hsxa-country-img`）本身是内联 SVG、alt 固定为 "country"，无任何国家信息，故从相邻的 country 链接取值；
- 侧栏世界地图是 ECharts 画的 canvas（国家不是 DOM 元素，且页面未暴露 echarts 实例），采用悬停 tooltip 提取：右键时鼠标所在国家的 tooltip（“加拿大 : 9233”或"NO : 0"）必然可见，从中解析中文名或 ISO 代码。
