# FOFA 右键排除搜索（Tampermonkey 用户脚本）

在 FOFA 结果页右键各类元素，将该项「包含 / 排除」追加到当前搜索语句，并在新标签页打开。

## 功能

| 右键对象 | 生成的条件示例 |
|---|---|
| 组件 / 产品 / 侧边筛选链接 | `product!="HIKVISION-视频监控"`（从链接自身的 qbase64 提取，值与点击该组件搜索的完全一致） |
| 国家旗帜图片 | `country="CN"`（从图片文件名 / class / alt 识别 ISO 代码，支持中英文国名） |
| 协议图标 | `protocol="https"` |
| 站点 favicon | `icon_hash="2460994409"`（在线计算 mmh3 hash） |
| 划选文本 / 普通标签 | `product="选中文本"`（可识别国名、协议名） |

- 排除 = 将条件取反后追加：`当前语句 && product!="X"`
- 菜单内条件可编辑，回车 = 排除并打开；另有「包含」「复制完整语句」
- 未命中可识别对象时不劫持右键，保持浏览器原生菜单

## 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展；
2. Tampermonkey → 添加新脚本 → 粘贴 `fofa-exclude.user.js` 全文 → `Ctrl+S` 保存；
3. Chrome（Manifest V3）需在 `chrome://extensions` → Tampermonkey → 详情中开启「允许运行用户脚本」。

## 配置

脚本开头的常量：

- `OPEN_IN_BACKGROUND`：`true` 时新标签页在后台打开（便于连续排除多项）。

## 说明

- favicon 跨域获取失败时自动回退 `GM_xmlhttpRequest`（需要 `@connect *` 权限）；
- `icon_hash` 与 FOFA 官方一致：mmh3(base64(favicon 字节))，有符号 32 位整数。
