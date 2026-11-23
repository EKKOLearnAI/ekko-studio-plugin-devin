import assert from 'node:assert/strict'

export async function assertResourceLoaded(frame) {
  await frame.locator('.dv-manager[aria-busy="false"]').waitFor()
  const transient = frame.getByRole('status').filter({ hasText: /^Loading…$/ })
  assert.equal(await transient.count(), 0, 'Resource status should clear once the initial load is done')
}

export async function assertMobileSkillSaved(page, frame, skillName) {
  await frame.locator('.dv-skills-sidebar').waitFor({ state: 'hidden' })
  await frame.getByRole('heading', { name: skillName, exact: true }).waitFor()
  const feedback = frame.getByRole('status').getByText('Saved. Changes apply on the next turn.', { exact: true })
  await feedback.waitFor()
  const bounds = await feedback.boundingBox()
  const viewport = page.viewportSize()
  assert.ok(bounds && viewport && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height,
    'Save feedback should be visible in the viewport while the Skill detail is open')
}
