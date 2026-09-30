export async function navigateToProjectSection(page, name) {
  // A reload's load event may precede React mounting. Wait for the current
  // page before deciding whether a responsive navigation trigger exists.
  await page.getByRole('main').getByRole('heading', { level: 1 }).waitFor();
  const navigation = page.getByRole('navigation', { name: '企画内ナビゲーション' });
  const link = navigation.getByRole('link', { name, exact: true });
  const menuButton = page.getByRole('button', { name: /企画メニューを/ });
  if (await menuButton.isVisible() && await menuButton.getAttribute('aria-expanded') !== 'true') {
    await menuButton.click();
  }
  await link.click();
  await page.getByRole('heading', { level: 1, name, exact: true }).waitFor();
}
