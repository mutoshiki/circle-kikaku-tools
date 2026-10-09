export async function openRoutePlannerFromMovementSettings(dialog) {
  await dialog.getByRole('button', { name: '移動距離計算ツール', exact: true }).click();
}

export async function returnToMovementSettingsFromRoutePlanner(dialog) {
  await dialog.getByRole('button', { name: '戻る', exact: true }).click();
}
