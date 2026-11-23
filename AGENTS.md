# Alchemy Collaboration Guide

## 修改前

1. 先完整阅读根目录 `PRODUCT.md`。
2. 找到修改对应的领域概念，再定位页面和组件。
3. 区分产品语义变更、领域实现变更与纯 UI 调整。

## 产品约束

- 不得擅自改变五阶段生命周期、演化动作或它们的当前产品语义。
- 不得因为 UI、路由或样式调整而隐式修改底层业务模型。
- Object 必须保留 Lineage 与追加式 Evolution / Transition History。
- 当前状态只是历史投影；不要用单一 current status 替代演化历史。
- Lineage 统一按 `sourceObjectId → targetObjectId` 使用方向明确的关系名。
- 不引入“回退到过去状态”的领域操作；新的现实信息产生新的事件或 Cycle。
- 使用 `PRODUCT.md` 已定义的领域术语，避免同一概念出现多套名称。
- 状态流转与核心业务规则应集中在 domain 层，不得散落在 UI Component 中。

## 修改边界

- UI、样式、布局和局部交互可以在不改变产品语义的前提下灵活调整。
- Object Model、Lifecycle、Transition Rule、Lineage、Evolution、Cycle 的修改属于高影响变更，必须检查历史可追溯性与所有消费方。
- 如果新需求与 `PRODUCT.md` 冲突，先明确指出冲突；不要自行重构核心模型。
- 五阶段可以在未来经明确产品决策修订，但普通开发任务和重构无权顺带修改它。
- 不要为了可能的未来需求提前建设复杂规则引擎或无实际用途的抽象层。

## 代码原则

- domain 不依赖 React；UI 消费领域定义，不重新声明领域规则。
- 生命周期顺序、名称、演化动作和转换验证只有一个事实源。
- Mock Data、查询/投影逻辑、Feature 与基础 UI 保持清楚边界。
- 优先使用稳定、显式的领域命名；避免 `item`、`data`、`record` 等模糊名称承载核心概念。
- 具体实现细节以代码为准。只有复杂度真实增长时才增加架构文档。

## 完成修改

- 运行构建和与改动相关的检查。
- 确认 Global / Object 上下文、Lineage 方向和 Evolution 时间顺序没有被破坏。
- 若产品基线发生经批准的变化，同步更新 `PRODUCT.md`。
