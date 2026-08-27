export default async function run(page) {
  await page.getByRole('textbox', { name: 'Email' }).fill('admin@livesupport.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin123');
  await page.waitForFunction(() => Array.from(document.querySelectorAll('select option')).some((option) => option.textContent.includes('Ikeja')));
  const branch = page.locator('select').first();
  const ikeja = await branch.locator('option').filter({ hasText: 'Ikeja' }).first().getAttribute('value');
  if (ikeja) await branch.selectOption(ikeja);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await page.goto('http://localhost:3000/ai-learning');
  await page.getByRole('heading', { name: 'AI Learning' }).waitFor();
  return {
    url: page.url(),
    title: await page.title(),
    progressChart: await page.locator('[class*="min-h-[290px]"]').count(),
    hasCandidates: await page.getByText('Learning candidates', { exact: true }).count(),
    hasRealEmptyState: await page.getByText("Your AI hasn't accumulated enough learning data yet.", { exact: true }).count()
  };
}
