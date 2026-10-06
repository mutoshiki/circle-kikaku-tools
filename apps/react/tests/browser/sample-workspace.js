import {expect} from '@playwright/test';
import {navigateToProjectSection} from './project-navigation.js';
export async function openSampleWorkspace(page,type='通常サンプル') {
  await navigateToProjectSection(page,'履歴');
  await page.getByRole('link',{name:'サンプルデータ',exact:true}).click();
  const review=page.getByRole('button',{name:'現在の内容を確認',exact:true}),confirm=page.getByRole('button',{name:'置換内容を確認',exact:true});
  await expect.poll(async()=>await confirm.isEnabled() || await review.isVisible()).toBe(true);
  if(await review.isVisible())await review.click();
  await expect(confirm).toBeEnabled();
  const radio=page.getByRole('radio',{name:type,exact:true});await radio.focus();await radio.press('Space');
}
export async function confirmSampleReplacement(page) {
  await page.getByRole('button',{name:'置換内容を確認',exact:true}).click();
  const dialog=page.getByRole('dialog');const understanding=dialog.getByRole('checkbox');
  await understanding.focus();await understanding.press('Space');
  await dialog.getByRole('button',{name:'サンプルで置き換える',exact:true}).click();await expect(dialog).toHaveCount(0);
  const review=page.getByRole('button',{name:'現在の内容を確認',exact:true});if(await review.count())await review.click();
}
export async function replaceSample(page,type='通常サンプル') {
  const previous=page.url();await openSampleWorkspace(page,type);await confirmSampleReplacement(page);await page.goto(previous);
}
