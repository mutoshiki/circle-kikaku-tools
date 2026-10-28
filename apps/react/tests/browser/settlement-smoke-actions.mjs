export async function openVehicleExpenseEditor(page, { carLabel, action }) {
  if (!['入力', '編集'].includes(action)) {
    throw new Error(`Unsupported vehicle expense action: ${action}`);
  }
  // The accordion heading has an accessible name that includes its purpose
  // ("支払い内訳"), so it no longer matches the visible car label alone.
  // The action's accessible name already identifies the car unambiguously.
  await page.getByRole('button', { name: `${carLabel}の費用を${action}`, exact: true }).click();
  return page.getByRole('dialog', { name: new RegExp(`^${carLabel}：`) });
}

export async function openRoutePlannerFromMovementSettings(dialog) {
  await dialog.getByRole('button', { name: 'ルートから距離を計算', exact: true }).click();
}

export async function returnToMovementSettingsFromRoutePlanner(dialog) {
  await dialog.getByRole('button', { name: '戻る', exact: true }).click();
}
