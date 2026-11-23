# Alchemy Product Baseline

## 最高原则：生成机制高于对象模型

Alchemy 用工程抽象观察、记录、计算和追溯现实中的生成过程。`Object`、`Lineage`、`Evolution`、`Cycle`、`Decision` 都服务于这一目标，并非不可改变的本体定义。

当前对通用生成机制的产品化表达是：

`汇入 → 提炼 → 规划 → 实现 → 验证`

更抽象地说：

`接收现实 → 识别结构 → 形成可能形式 → 进入现实 → 接受现实检验 → 产生新的输入`

对象是暂时的“象”，数据结构是可计算的“数”，**生成机制是当前持续逼近的“理”**。

当前模型应忠实记录：发生了什么、由什么生成、如何变化、为什么变化。模型未来可以继续提炼，但必须保留历史、来源关系与决策依据的可追溯性。V1 不为此提前建设通用规则引擎。

## 产品定位

Alchemy 不是传统需求表格，而是产品对象生成与演化的工作空间。V1 聚焦需求管理闭环；长期方向是：

`Signal → Requirement → Feature → Product → SOP → Skill → Agent`

Alchemy 是底层生成与演化哲学，不是炼金术视觉主题。界面不得使用炼金炉、魔法阵、羊皮纸、神秘学或游戏化表达。

## 共享生成相位

当前固定使用五个生成相位：

`原始需求 → 需求提炼 → 产品规划 → 研发实现 → 交付验证`

需求提炼只负责把一个或多个 Signal 整理为适合评审的 Requirement Candidate。Candidate 的最小内容为标题、需求描述、来源 Signal 与可选提炼说明，不承载优先级、负责人、版本、方案或研发设计。人工提炼与 AI 建议地位平行；多条 Signal 由分析器给出一个或多个分组建议，用户可以调整分组后确认，不默认执行 N → 1 合并。

评审产生新的需求理解时，可以结合原 Requirement、其来源 Signal 与评审备注再次提炼。确认后更新同一个 Requirement，并追加 Decision、Evolution 与内容调整 Transformation；不创建同义 Requirement。Requirement 合并与拆分则是显式的对象生成操作：必须先形成 Candidate 并由人确认，来源对象永久保留，新对象从 Cycle 1、产品规划待评审开始，目标版本重新规划。

它们对应 `汇入 → 提炼 → 规划 → 实现 → 验证`，是跨 ObjectType 的通用生成机制，而非 Requirement 专属流程。未来对象类型优先复用该机制，再定义各自输入、输出、字段和验证规则。

五阶段是当前稳定的产品基线和最佳产品化表达，不被宣称为终极真理。任何修订必须是明确的产品决策，不能由 UI 改动或代码重构隐式发生。

五阶段是 Global View 中观察全部对象及其当前 Stage 的生命周期入口，同时对应对象当前 Stage 的投影。User View 不重复展示完整 Lifecycle，而通过“总览 / 工作区”呈现当前观察者的 Attention 与 Action。Workspace、Stage、Object Type 与 Transformation 不互相替代：Object 是长期存在的事实实体，Stage 只描述当前处理位置，Workspace 只决定当前主体在哪里处理它，Transformation 才描述真实的业务生成或形态变化。对象离开某个工作队列后仍须保留并可追溯。

## 三个观察维度

- 横向看演化：Lifecycle。
- 纵向看尺度：Global View 观察阶段整体，Object View 观察单个对象；二者是同一产品的不同尺度。
- 向内看因果：见象（当前形态）→ 察数（结构与关系）→ 明理（历史与原因）。“象、数、理”不直接作为 UI 栏目。

## Object 与 Observer

Alchemy 始终处理两个相互作用的主体：

- **Object**：在时间中持续演化的对象。
- **Observer / Actor**：从某个位置观察并作用于对象的人、角色、团队或未来的 Agent。

基本过程不是仅靠状态推进的线性 Workflow，而是：

`对象出现 → 被观察 → 形成注意 → 产生行动 → 对象发生变化 → 再次被观察`

Object 的客观状态与 Observer 看到的投影必须分离。切换观察者不改变 Object、Lifecycle、Lineage 或历史，只改变对象如何向当前主体显现。

## 主体介入：View → Attention → Action

- **View** 回答“我站在哪里看？”它决定观察位置，不改变对象本身。
- **Attention** 回答“在这个位置上，什么值得我关注？”它把全部对象压缩为与当前主体相关的风险、异常、待决策事项、待推进事项和重要变化。产品 UI 对应“总览”。
- **Action** 回答“在这个位置上，我现在能够处理什么？”它进一步收敛为当前主体实际可以处理和推进的对象集合。产品 UI 对应“工作区”。

总览不是简单统计 Dashboard，工作区也不是 Lifecycle 的另一种表达。角色差异发生在 Attention / Action 的投影规则中，不发生在导航骨架或 Lifecycle 定义中。

完整闭环为：

`World → View → Attention → Action → Evolution → World'`

对象的状态决定主体能够看到和处理什么；主体确认的行动追加 Evolution Event，并形成新的对象状态或新的 Object；新的 World 再次进入观察循环。AI 可以生成候选、建议或草稿，但未经相应治理确认不得直接覆盖原始事实或正式对象。

## Global View 与 User View

**Global View** 不站在某个具体角色的位置，观察全部对象及完整 Lifecycle：

`原始需求 → 需求提炼 → 产品规划 → 研发实现 → 交付验证`

Global View 的默认 Scope 为全部对象。其“总览”呈现系统整体 Attention，包括生命周期分布、对象数量、阻塞风险、阶段积压、近期变化与整体推进；“生命周期”进入五阶段查看全部对象。Global View 不显示角色“工作区”。

**User View** 由具体的 `用户 + Role` 构成。当前面试演示版仅提供“总视图 / 产品 / 研发 / 管理”，各角色对应一个匿名示例用户，研发示例合并原研发演示数据；这只是演示数据与入口简化，不引入团队角色汇总机制。系统将 Global Objects 投影为：

`Global Objects → View → 总览（Attention）→ 工作区（Action）`

User View 不把 Lifecycle Stage 作为一级导航。产品、研发、管理等角色共用“总览 / 工作区”骨架，差异只来自对象投影、Attention、Action 与默认 Scope。面试演示版三种角色默认 Scope 均为全部；“我负责的 / 我提出的”指当前示例用户，Scope 不改变 Lifecycle。

产品层使用“当前视图 / 总览 / 工作区 / 生命周期 / 来源与去向 / 演化记录 / 当前状态”等简洁表达，不直接暴露 View、Attention、Action、象、数、理等理论标签。

## 两条演化轴

Alchemy 的演化地图同时表达两条机制：

- **Object Evolution**：物如何变化。V1 的显性 Stage 为五阶段，底层动作是 `汇入 → 提炼 → 规划 → 实现 → 验证`。
- **Observer Loop**：主体如何参与变化，统一为 `View → Attention → Action`。

两条轴通过 Evolution 相互作用：Action 作用于 Object，产生新的 Event、State、Transformation 或 Object；Lineage 保留对象之间的来源与生成关系。

## 核心工程概念

- **Object**：生成过程中当前可观察的对象形态。V1 主要是 Signal 与 Requirement。
- **Transformation**：Object 发生的一次具有业务意义的生成或形态变化。V1 只记录提炼、合并、拆分、产生新 Signal 和 Requirement 内容实质调整；普通管理字段、过程状态、Cycle 变化与误操作恢复不属于 Transformation。
- **Lineage**：对象之间有方向的来源、生成、合并和拆分关系。统一按 `sourceObjectId → targetObjectId` 阅读。生成新对象不覆盖或删除旧对象；多对一和一对多都必须可追溯。
- **Evolution**：只沿时间追加的变化历史。当前状态只是完整历史在当前时刻的投影，不能替代历史。
- **Cycle**：同一个 Object 的一轮完整处理周期。Stage 表示这一轮处理到哪里，Event 表示这一轮具体发生了什么。普通字段更新、评审、研发状态变化和误操作后的“返回上一步”都沿用当前 Cycle；只有一轮已经形成业务结论、同一 Object 仍需继续处理时才开始下一 Cycle。V1 中该边界主要发生在交付验证后进入下一轮研发或下一轮规划。
- **Decision**：记录对象为什么发生状态、优先级、合并、版本或范围变化。
- **Version**：产品规划中的轻量发布目标容器，用于记录一组 Requirement / Implementation 如何收敛到一次产品迭代，可包含目标与计划时间范围。Version 完成度由关联对象聚合，执行进度来自 Implementation；Version 与 Cycle 解耦，不是 Object Type，也不承载 Sprint、资源排程或独立的任务进度。

不存在“回退到过去状态”的领域语义。验证失败应追加验证结果，并触发新的事件或演化周期；历史事件不得覆盖。

Transformation 与 Lineage、Evolution 分别记录“发生了什么业务变化”“对象之间由什么生成”“时间中记录了哪些事实”。一次 Transformation 可以产生零到多条 Lineage；例如合并和拆分各自是一项 Transformation 并关联多条 Lineage，而内容调整可以有 Transformation 但不产生新对象或 Lineage。

Signal 的 Raw 层按来源保持异构并永久保留，Unified 层才提供统一管理字段。产品反馈沿用外部反馈系统的结构化 Raw，经 Mapper 直接进入待提炼且标记 `not_required`；用户反馈与团队发现保留原始表达，共用可替换 Standardizer 生成 Candidate，经人工确认后进入待提炼。任何标准化结果都不得覆盖 Raw。

## V1 范围

V1 优先验证 App Shell、总览、五阶段 Lifecycle、原始需求、产品规划、对象详情、Lineage、Evolution 和 Mock Data。其余阶段提供一致的可用基础视图。

V1 暂不实现持久化、权限、复杂知识图谱、完整业务表单、通用规则引擎或 Feature / Product / SOP / Skill / Agent 的具体逻辑。

## 体验原则

视觉方向是 Modern Research Workspace：Minimal、Structural、Evolving、Precise、Quiet。使用浅色空间、克制强调色、细分割线和中等信息密度。产品辨识度来自 Lifecycle、Lineage、对象关系与状态变化，而非装饰。

## 公开展示版边界

本版本使用完全合成的预置数据。所有分析均为 Mock，不读取模型密钥；移除企业连接、托管标识与外部发送实现。反馈导入仅加载固定合成案例，简报只预览预置快照。角色切换不代表权限。内存状态不构成持久化审计日志。长期方向不代表已实现功能。
