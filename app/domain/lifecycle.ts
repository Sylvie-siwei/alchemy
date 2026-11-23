export const lifecycleStages = [
  { id: "intake", label: "原始需求", action: "汇入", description: "现实中的反馈、缺陷与想法进入系统" },
  { id: "refinement", label: "需求提炼", action: "提炼", description: "澄清、拆分、去重并识别问题结构" },
  { id: "planning", label: "产品规划", action: "规划", description: "判断价值并形成产品方案与版本计划" },
  { id: "implementation", label: "研发实现", action: "实现", description: "把规划转化为可工作的现实产品" },
  { id: "validation", label: "交付验证", action: "验证", description: "通过测试和验收接受现实检验" },
] as const;

export type LifecycleStage = (typeof lifecycleStages)[number]["id"];

export const stageIndex = (stage: LifecycleStage) =>
  lifecycleStages.findIndex((candidate) => candidate.id === stage);

export const stageById = (stage: LifecycleStage) =>
  lifecycleStages.find((candidate) => candidate.id === stage)!;
