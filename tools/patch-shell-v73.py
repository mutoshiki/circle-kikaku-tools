from pathlib import Path


def replace_once(path, before, after):
    p = Path(path)
    source = p.read_text(encoding='utf-8')
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    p.write_text(source.replace(before, after), encoding='utf-8')


replace_once(
    'assets/js/features/events/02-static-header-events.js',
    """        document.addEventListener('wheel', event => {\n            if (event.deltaY < -PROJECT_TITLE_SCROLL_THRESHOLD && getActiveProjectTitleScrollTop() <= 0) setProjectTitleExpanded(true);\n        }, { passive: true });""",
    """        document.addEventListener('wheel', event => {\n            if (event.deltaY > PROJECT_TITLE_SCROLL_THRESHOLD) {\n                setProjectTitleExpanded(false);\n                return;\n            }\n            if (event.deltaY < -PROJECT_TITLE_SCROLL_THRESHOLD && getActiveProjectTitleScrollTop() <= 0) setProjectTitleExpanded(true);\n        }, { passive: true });"""
)

replace_once(
    'assets/js/features/events/02-static-header-events.js',
    """        document.addEventListener('pointermove', event => {\n            if (event.pointerType !== 'touch' || projectTitlePointerStartY === null) return;\n            if (getActiveProjectTitleScrollTop() <= 0 && event.clientY - projectTitlePointerStartY >= PROJECT_TITLE_PULL_THRESHOLD) {\n                setProjectTitleExpanded(true);\n                projectTitlePointerStartY = event.clientY;\n            }\n        }, { passive: true });""",
    """        document.addEventListener('pointermove', event => {\n            if (event.pointerType !== 'touch' || projectTitlePointerStartY === null) return;\n            const deltaY = event.clientY - projectTitlePointerStartY;\n            if (deltaY <= -PROJECT_TITLE_PULL_THRESHOLD) {\n                setProjectTitleExpanded(false);\n                projectTitlePointerStartY = event.clientY;\n                return;\n            }\n            if (getActiveProjectTitleScrollTop() <= 0 && deltaY >= PROJECT_TITLE_PULL_THRESHOLD) {\n                setProjectTitleExpanded(true);\n                projectTitlePointerStartY = event.clientY;\n            }\n        }, { passive: true });"""
)

replace_once(
    'assets/js/features/events/02-static-header-events.js',
    "bind('overviewMenuBtn', () => setAppNavigationDrawerOpen(drawer.getAttribute('aria-hidden') !== 'true'));",
    "bind('overviewMenuBtn', () => setAppNavigationDrawerOpen(drawer.getAttribute('aria-hidden') === 'true'));"
)

replace_once(
    'tests/carbon-complete.visual.spec.js',
    """    await page.locator('#top-area').evaluate(node => { node.scrollTop = 64; node.dispatchEvent(new Event('scroll')); });\n    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'collapsed');\n    await page.locator('#top-area').evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll')); });\n    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'collapsed');\n    await page.dispatchEvent('#top-area', 'wheel', { deltaY: -120 });\n    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'expanded');""",
    """    await page.dispatchEvent('#top-area', 'wheel', { deltaY: 120 });\n    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'collapsed');\n    await expect.poll(() => page.locator('#projectTitleRegion').evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(1);\n    await page.dispatchEvent('#top-area', 'wheel', { deltaY: -120 });\n    await expect(page.locator('#projectTitleRegion')).toHaveAttribute('data-state', 'expanded');"""
)

replace_once(
    'tests/shell-project-title-navigation-v73.spec.js',
    """    await page.locator('#top-area').evaluate(node => {\n      node.scrollTop = 80;\n      node.dispatchEvent(new Event('scroll'));\n    });\n    await expect(title).toHaveAttribute('data-state', 'collapsed');\n    expect(await title.evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(1);\n\n    await page.locator('#top-area').evaluate(node => {\n      node.scrollTop = 0;\n      node.dispatchEvent(new Event('scroll'));\n    });\n    await expect(title).toHaveAttribute('data-state', 'collapsed');\n\n    if (viewport.width <= 390) {\n      await page.dispatchEvent('#top-area', 'pointerdown', { pointerType: 'touch', clientY: 120, pointerId: 1, isPrimary: true });\n      await page.dispatchEvent('#top-area', 'pointermove', { pointerType: 'touch', clientY: 152, pointerId: 1, isPrimary: true });\n      await page.dispatchEvent('#top-area', 'pointerup', { pointerType: 'touch', clientY: 152, pointerId: 1, isPrimary: true });\n    } else {\n      await page.dispatchEvent('#top-area', 'wheel', { deltaY: -120 });\n    }\n    await expect(title).toHaveAttribute('data-state', 'expanded');""",
    """    if (viewport.width <= 390) {\n      await page.dispatchEvent('#top-area', 'pointerdown', { pointerType: 'touch', clientY: 180, pointerId: 1, isPrimary: true });\n      await page.dispatchEvent('#top-area', 'pointermove', { pointerType: 'touch', clientY: 148, pointerId: 1, isPrimary: true });\n      await page.dispatchEvent('#top-area', 'pointerup', { pointerType: 'touch', clientY: 148, pointerId: 1, isPrimary: true });\n    } else {\n      await page.dispatchEvent('#top-area', 'wheel', { deltaY: 120 });\n    }\n    await expect(title).toHaveAttribute('data-state', 'collapsed');\n    await expect.poll(() => title.evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(1);\n\n    if (viewport.width <= 390) {\n      await page.dispatchEvent('#top-area', 'pointerdown', { pointerType: 'touch', clientY: 120, pointerId: 2, isPrimary: true });\n      await page.dispatchEvent('#top-area', 'pointermove', { pointerType: 'touch', clientY: 152, pointerId: 2, isPrimary: true });\n      await page.dispatchEvent('#top-area', 'pointerup', { pointerType: 'touch', clientY: 152, pointerId: 2, isPrimary: true });\n    } else {\n      await page.dispatchEvent('#top-area', 'wheel', { deltaY: -120 });\n    }\n    await expect(title).toHaveAttribute('data-state', 'expanded');"""
)

replace_once(
    'tests/shell-project-title-navigation-v73-contract.mjs',
    """assert.match(js, /setProjectTitleExpanded\\(false\\)/);\nassert.match(js, /event\\.pointerType === 'touch'/);\nassert.match(js, /event\\.deltaY < -PROJECT_TITLE_SCROLL_THRESHOLD/);""",
    """assert.match(js, /setProjectTitleExpanded\\(false\\)/);\nassert.match(js, /event\\.pointerType === 'touch'/);\nassert.match(js, /deltaY <= -PROJECT_TITLE_PULL_THRESHOLD/);\nassert.match(js, /event\\.deltaY > PROJECT_TITLE_SCROLL_THRESHOLD/);\nassert.match(js, /event\\.deltaY < -PROJECT_TITLE_SCROLL_THRESHOLD/);"""
)

print('Applied v73 interaction regression fixes.')
