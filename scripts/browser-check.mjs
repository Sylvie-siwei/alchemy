import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const base = process.env.ALCHEMY_DEMO_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'msedge', headless: true } : { headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const failures=[], external=[], checkpoints=[];
page.on('pageerror', error => failures.push(error.message));
page.on('request', request => { const url=request.url(); if (/^https?:/.test(url) && new URL(url).origin !== new URL(base).origin) external.push(url); });
const output = new URL('../artifacts/', import.meta.url); await fs.mkdir(output,{recursive:true});
try {
  await page.goto(base); await page.waitForLoadState("networkidle"); await expect(page.getByText('公开作品演示', { exact: false })).toBeVisible();
  await expect(page.getByLabel('切换当前视图')).toBeVisible();
  await page.screenshot({path:fileURLToPath(new URL('overview.png',output)),fullPage:true});
  for (const role of ['product','engineering','management','global']) { await page.getByLabel('切换当前视图').selectOption(role); await expect(page.locator('.nav-button').filter({hasText:'总览'})).toBeVisible(); }
  checkpoints.push('四种视图切换');
  await page.locator('.nav-button').filter({hasText:'原始需求'}).click();
  await page.getByRole('button',{name:'＋ 新增需求',exact:true}).click();
  if (await page.getByRole('menuitem',{name:/手动新增/}).count()) await page.getByRole('menuitem',{name:/手动新增/}).click();
  const form=page.getByRole('dialog',{name:'新需求',exact:true});
  await form.getByLabel('标题（选填）').fill('浏览器验证：合成运行回执');
  await form.getByLabel('原始内容',{exact:true}).fill('虚构沙盒任务提交后需要显示排队回执。');
  await form.getByRole('button',{name:'确认汇入',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('浏览器验证：合成运行回执');
  checkpoints.push('手动新增虚构反馈');
  await page.locator('.nav-button').filter({hasText:'需求提炼'}).click();
  await page.getByRole('checkbox',{name:/选择 沙盒任务单次运行/}).check();
  await page.getByRole('checkbox',{name:/选择 再次提出单次试跑/}).check();
  await page.getByRole('button',{name:/提炼所选|开始提炼|提炼选中/}).click();
  const refine=page.getByRole('dialog',{name:'需求提炼',exact:true});
  await refine.getByRole('button',{name:'开始 AI 分析',exact:true}).click();
  await refine.getByRole('button',{name:'接受合并',exact:true}).click();
  await refine.getByRole('button',{name:'进入需求确认',exact:true}).click();
  await refine.getByRole('button',{name:'编辑',exact:true}).click();
  await refine.getByLabel('标题',{exact:true}).fill('浏览器确认：合成任务单次试跑');
  await refine.getByRole('button',{name:'完成编辑',exact:true}).click();
  await page.screenshot({path:fileURLToPath(new URL('human-confirmation.png',output)),fullPage:true});
  await refine.getByRole('button',{name:/确认提炼 1 条需求/}).click();
  await expect(page.getByRole('dialog').filter({hasText:'浏览器确认：合成任务单次试跑'})).toBeVisible();
  await page.getByRole('tab',{name:'演化记录',exact:true}).click(); await expect(page.getByRole('button',{name:/沙盒任务单次运行/})).toBeVisible(); await expect(page.getByRole('button',{name:/再次提出单次试跑/})).toBeVisible();
  checkpoints.push('Mock 提炼 → 接受合并 → 人工改写 → 正式需求与来源追溯');
  // Close the detail drawer through its explicit close control.
  await page.getByRole('button',{name:'关闭详情',exact:true}).last().click();
  await page.locator('.nav-button').filter({hasText:'设置'}).click();
  await page.getByRole('button',{name:'预览合成简报',exact:true}).click();
  await expect(page.getByRole('heading',{name:/团队日报/})).toBeVisible();
  await expect(page.getByRole('button',{name:/发送|配置连接/})).toHaveCount(0);
  checkpoints.push('简报只预览且无凭证配置和发送按钮');
  if(failures.length || external.length) throw new Error(JSON.stringify({failures,external}));
  await fs.writeFile(new URL('browser-result.json',output),JSON.stringify({passed:true,checkpoints,pageErrors:failures,externalRequests:external},null,2));
  console.log(JSON.stringify({passed:true,checkpoints,pageErrors:failures,externalRequests:external},null,2));
} catch(error) {
  console.log((await page.locator('body').innerText()).slice(-12000));
  await page.screenshot({path:fileURLToPath(new URL('failure.png',output)),fullPage:true});
  throw error;
} finally { await browser.close(); }
