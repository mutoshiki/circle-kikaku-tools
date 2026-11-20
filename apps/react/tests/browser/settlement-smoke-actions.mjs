export async function revealVehicleExpenseActions(car) {
  const action = car.getByRole('button', { name: /の費用を(?:入力|編集)$/ });
  if (!await action.isVisible()) {
    const disclosure = car.locator('.settlement-car-toggle');
    if (await disclosure.getAttribute('aria-expanded') !== 'true') await disclosure.click();
  }
  return action;
}

export async function openVehicleExpenseEditor(page, { carLabel, action }) {
  if (!['入力', '編集'].includes(action)) {
    throw new Error(`Unsupported vehicle expense action: ${action}`);
  }
  const car = page.locator('.settlement-car').filter({
    has: page.locator('.settlement-car-name', { hasText: carLabel }),
  });
  await revealVehicleExpenseActions(car);
  await car.getByRole('button', { name: `${carLabel}の費用を${action}`, exact: true }).click();
  return page.getByRole('dialog', { name: new RegExp(`^${carLabel}：`) });
}

export async function openDistanceGuideFromMovementSettings(dialog) {
  await dialog.getByRole('button', { name: 'Googleマップで距離を確認', exact: true }).click();
}

export async function returnToMovementSettingsFromDistanceGuide(dialog) {
  await dialog.getByRole('button', { name: '戻る', exact: true }).click();
}
