# 第三方代码、模板与素材许可核查

核查日期：2026-11-23。核查对象是当前公开副本的源码发布准备，不是生产部署或二进制分发许可认证。**当前状态：此前列出的 favicon 与包装模板来源缺口，已通过替换、移除及重写最小配置处理；不再发布这两项未知来源的原件。原模板本身的许可仍未知，未将其追溯认定为已授权。原创部分已确定不授予开源许可，发布仅等待作者确认职务成果公开权利。**

## 证据与覆盖范围

- 锁文件中 616 个依赖条目：全部有 license 元数据，按安装路径和版本逐项登记；不是 616 个不同项目。
- 当前 Windows 安装树可读取 501 个条目，另外 115 个主要为未安装的平台/可选条目，未获取其完整包内容，只核查锁文件声明。
- 收集 481 份本地 LICENSE / NOTICE / ThirdPartyNotice 原文，保留包名、版本、原始路径和 SHA-256。包含 Vinext 的内嵌第三方声明、TypeScript ThirdPartyNoticeText 和 Playwright NOTICE。
- 32 个已安装条目未在包根或约定法律目录附带独立许可文本；清单在文末。此处不把“元数据声明”冒充“逐份源码法律审查”。部分由上游仓库许可补充佐证，下载快照已归档，但不声称浮动 main 快照等同安装版本的完整历史审查。
- 未改依赖或产品代码；node_modules、dist、运行日志与本机环境文件均仍被忽略，不作为拟公开仓库材料。未复制依赖实现代码到 app/。

文件：[完整清单](../third_party/dependency-inventory.json)、[481 份许可/声明原文](../third_party/DEPENDENCY_LICENSES.txt)、[上游与素材比对记录](../third_party/source-evidence.json)、[根 NOTICE](../NOTICE)。

## 直接依赖

| 包 | 锁定版本 | 声明许可 | 本地独立许可文本 |
| --- | --- | --- | --- |
| @cloudflare/vite-plugin | 1.70.1 | MIT | 未附带；参考上游/元数据 |
| @eslint/js | 9.39.4 | MIT | 已归档 |
| @next/eslint-plugin-next | 16.2.6 | MIT | 未附带；参考上游/元数据 |
| @playwright/test | 1.65.1 | Apache-2.0 | 已归档 |
| @tailwindcss/postcss | 4.2.1 | MIT | 已归档 |
| @types/node | 22.19.19 | MIT | 已归档 |
| @types/react | 19.2.14 | MIT | 已归档 |
| @types/react-dom | 19.2.3 | MIT | 已归档 |
| @vitejs/plugin-react | 6.0.2 | MIT | 已归档 |
| @vitejs/plugin-rsc | 0.5.39 | MIT | 未附带；参考上游/元数据 |
| eslint | 9.39.4 | MIT | 已归档 |
| eslint-plugin-jsx-a11y | 6.10.2 | MIT | 已归档 |
| eslint-plugin-react | 7.37.5 | MIT | 已归档 |
| eslint-plugin-react-hooks | 7.1.1 | MIT | 已归档 |
| globals | 16.4.0 | MIT | 已归档 |
| miniflare | 5.20261117.0-beta | MIT | 未附带；参考上游/元数据 |
| react | 19.3.1 | MIT | 已归档 |
| react-dom | 19.3.1 | MIT | 已归档 |
| react-server-dom-webpack | 19.3.1 | MIT | 已归档 |
| tailwindcss | 4.2.1 | MIT | 已归档 |
| typescript | 5.9.3 | Apache-2.0 | 已归档 |
| typescript-eslint | 8.73.0 | MIT | 已归档 |
| vinext | 1.4.6 | MIT | 已归档 |
| vite | 8.3.8 | MIT | 已归档 |
| wrangler | 4.166.0 | MIT OR Apache-2.0 | 未附带；参考上游/元数据 |

## 锁文件许可分布

| SPDX 表达式 | 条目数 |
| --- | ---: |
| MIT | 473 |
| MIT OR Apache-2.0 | 6 |
| Apache-2.0 | 51 |
| LGPL-3.0-or-later | 10 |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 |
| Apache-2.0 AND LGPL-3.0-or-later | 3 |
| BlueOak-1.0.0 | 2 |
| MPL-2.0 | 28 |
| CC0-1.0 | 2 |
| 0BSD | 2 |
| ISC | 17 |
| BSD-3-Clause | 6 |
| Python-2.0 | 1 |
| CC-BY-4.0 | 1 |
| BSD-2-Clause | 13 |

OR 与 AND 表达式保留原样；没有把混合许可或 copyleft 许可改标为 MIT。

## 模板与素材逐项结果（本轮更新）

| 本地内容 | 结论 | 处理 |
| --- | --- | --- |
| public/file.svg、globe.svg、window.svg | 与 Next.js v16.2.6 的 create-next-app 模板规范化文本一致；原始字节因换行/首尾空白不同而不同 | 保留 Vercel MIT 版权与许可原文，并在 NOTICE 署名 |
| public/favicon.svg | 旧蓝色四块图形已移除；当前为本次构造的几何 A 标识，无外部图形路径或字体 | 旧原件不发布；构造过程与哈希见 replacement-record.json |
| 原包装模板 | 原件许可未知；不声称框架 MIT 自动覆盖该模板。本轮重写最小 Vite/Worker/TS/PostCSS/ESLint/忽略配置，删除空 Next 配置，并由 Vinext 重新生成类型入口 | 待发布目录不包含旧模板特有宿主实现；不发布未知模板原件，详见最终准备报告 |
| public/demo-feedback.svg | 为公开版准备的通用合成示意图，制作记录可追溯 | 不冒充客户截图；原创部分不授予开源许可 |
| docs/screenshots/*.png | 从本地合成数据与 Mock 工作流实际截图 | 无真实客户图像；底层未知 favicon/模板不因截图而自动获得授权 |
| Mermaid 架构与领域模型图 | 根据本仓库类型和数据流编写；未复制外部架构图 | 不捆绑 Mermaid 实现；原创文档按 COPYRIGHT.md 保留权利 |
| 字体 | 应用使用系统字体栈；已无远程字体下载，也没有提交字体二进制 | 截图不作为字体文件再分发 |

Next.js 来源固定到 [v16.2.6 模板](https://github.com/vercel/next.js/tree/v16.2.6/packages/create-next-app/templates/app/js/public) 与 [该版本 MIT 许可](https://github.com/vercel/next.js/blob/v16.2.6/license.md)。三个图标的 Git blob、原始哈希、规范化比对结果在 source-evidence.json。

## 第三方版权与分发边界

- MIT / BSD / ISC 等声明按各包原文保留；Apache 组件同时保留可获取的 NOTICE。根 NOTICE 不代替这些原文；Alchemy 原创部分不授予开源许可，第三方仍维持原许可。
- Vinext 自带的第三方声明必须与其自身 MIT 一并阅读，不能只读取顶层 package.json。
- MPL 出现在 lightningcss、satori、@vercel/og、resvg、axe-core 等链路；LGPL 出现在 sharp/libvips 的平台包或组合表达式。当前不发布这些二进制或改动后的第三方库。若未来打包 dist、DLL、WASM、容器或桌面安装包，需要按实际分发内容重新核查源代码提供、通知及链接等条件，不能直接沿用“源码展示版已盘点”的结论。参阅 [Mozilla 官方 MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) 和 [GNU LGPLv3 正文](https://www.gnu.org/licenses/lgpl-3.0.html)。
- caniuse-lite 声明 CC-BY-4.0：NOTICE 中保留项目、来源、许可链接和未修改说明；参阅 [CC 官方条款](https://creativecommons.org/licenses/by/4.0/)。
- 开源许可不自动授权使用第三方商标作为自己的品牌；README 仅描述所用技术，不宣称厂商背书。

上游补充许可快照：[Workers SDK MIT](../third_party/upstream/workers-sdk-license-mit.txt)、[Workers SDK Apache](../third_party/upstream/workers-sdk-license-apache.txt)、[Vite React 插件仓库 MIT](../third_party/upstream/vite-react-license.txt)。这些快照保留原始版权行，未改写为作者自己的版权。

## 未附独立法律文本的已安装条目

- @cloudflare/kv-asset-handler@0.5.1 — MIT OR Apache-2.0
- @cloudflare/unenv-preset@2.16.2 — MIT OR Apache-2.0
- @cloudflare/vite-plugin@1.70.1 — MIT
- @cloudflare/kv-asset-handler@0.5.0 — MIT OR Apache-2.0
- wrangler@4.164.0 — MIT OR Apache-2.0
- @cloudflare/workerd-windows-64@1.20261117.1 — Apache-2.0
- @cloudflare/workers-utils@0.56.0 — MIT OR Apache-2.0
- @esbuild/win32-x64@0.28.2 — MIT
- @humanfs/types@0.15.0 — Apache-2.0
- @next/eslint-plugin-next@16.2.6 — MIT
- @resvg/resvg-wasm@2.4.1 — MPL-2.0
- @rolldown/binding-win32-x64-msvc@1.2.19 — MIT
- @unpic/core@1.0.3 — MIT
- @vitejs/plugin-rsc@0.5.39 — MIT
- undici-types@5.26.5 — MIT
- css-box-shadow@1.0.0-3 — MIT
- esrecurse@4.3.0 — BSD-2-Clause
- glob-to-regexp@0.4.1 — BSD-2-Clause
- imurmurhash@0.1.4 — MIT
- keyv@4.5.4 — MIT
- language-subtag-registry@0.3.23 — CC0-1.0
- language-tags@1.0.9 — MIT
- miniflare@5.20261117.0-beta — MIT
- natural-compare@1.4.0 — MIT
- tr46@0.0.3 — MIT
- unpic@4.2.2 — MIT
- workerd@1.20261117.1 — Apache-2.0
- wrangler@4.166.0 — MIT OR Apache-2.0
- @cloudflare/workerd-windows-64@1.20261119.1 — Apache-2.0
- miniflare@5.20261119.0-beta — MIT
- workerd@1.20261119.1 — Apache-2.0
- yoga-layout@3.2.1 — MIT

这份清单不是“无许可”名单；它明确区分安装包证据和元数据。没有这些依赖的源码或二进制被拷入拟公开源码目录，因此不能将它们的安装包文本缺口与应用内未知来源 favicon 混为同一结论。

## 发布门槛

1. 作者确认职务成果、雇佣/保密/委托约束允许公开。
2. 已记录作者选择：原创部分不授予开源许可，COPYRIGHT.md 与 UNLICENSED 元数据不覆盖第三方原许可。
3. 已按作者授权替换旧 favicon，并移除/重写已列出的旧包装配置；旧原件不发布。
4. 发布清单只含源码、合成素材、截图、文档与本次声明；不包含 node_modules、dist、artifacts 或旧 .git。

目标仓库为 Sylvie-siwei/alchemy；当前未创建、未推送，也未改动 alchemy-v1。只有发布完成后才能验证匿名访问并提供已核验的公开链接。

## 本轮复核结果

89 个文件完成模式复扫；153 条非示例邮箱命中全部位于逐字保留的第三方许可证据中，用于上游公共版权署名，未删除或匿名化。应用与其他文档没有其他规则命中。公开副本 65 个原有非展示文件、原仓库 78 个非 Git 文件的 SHA-256 均与基线一致；35 个本地文档引用存在。没有创建根 LICENSE、Git 历史或远端。


## 最终准备补充

本轮没有增加依赖或扩大审计范围。原稿中的旧图标/包装来源问题已通过本轮替换/移除处理；当时的“没有根许可文件”等状态应结合当前 COPYRIGHT.md 阅读。完整变更与新验证见 [FINAL_RELEASE_PREP.md](FINAL_RELEASE_PREP.md)。
