from pathlib import Path

path = Path('tools/apply-shell-v73.mjs')
source = path.read_text(encoding='utf-8')
replacements = {
    "assert.doesNotMatch(`${header}\\n${room}`, /!important/);": "assert.doesNotMatch(header + '\\\\n' + room, /!important/);",
    "  test(`${viewport.width}px title reveal and application navigation`, async ({ page }) => {": "  test(String(viewport.width) + 'px title reveal and application navigation', async ({ page }) => {",
}
for before, after in replacements.items():
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'expected one match, found {count}: {before}')
    source = source.replace(before, after)
path.write_text(source, encoding='utf-8')
print('Fixed temporary runner quoting.')
