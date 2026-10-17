export async function openVehicleExpenseEditor(page, { carLabel, action }) {
  if (!['入力', '編集'].includes(action)) {
    throw new Error(`Unsupported vehicle expense action: ${action}`);
  }
  const car = page.locator('.settlement-car').filter({
    has: page.getByRole('heading', { name: carLabel, exact: true }),
  }).first();
  await car.getByRole('button', { name: `${carLabel}の費用を${action}`, exact: true }).click();
  return page.getByRole('dialog', { name: new RegExp(`^${carLabel}：`) });
}

export async function openRoutePlannerFromMovementSettings(dialog) {
  await dialog.getByRole('button', { name: '移動距離計算ツール', exact: true }).click();
}

export async function returnToMovementSettingsFromRoutePlanner(dialog) {
  await dialog.getByRole('button', { name: '戻る', exact: true }).click();
}
