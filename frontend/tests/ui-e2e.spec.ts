import { test, expect, Page } from '@playwright/test'
import type { TestInfo } from '@playwright/test'
import path from 'path'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3010'
const email = process.env.PLAYWRIGHT_EMAIL || 'test-upload-1768988767690@example.com'
const password = process.env.PLAYWRIGHT_PASSWORD || 'TestPassword123!'
const notebookName = process.env.PLAYWRIGHT_KB_NAME || 'Test Upload KB'
const notebookId = process.env.PLAYWRIGHT_KB_ID

async function ensureConnection(page: Page) {
  const overlayTitle = page.getByRole('heading', {
    name: /Database Connection Failed|Unable to Connect to API Server/i,
  })
  if (await overlayTitle.isVisible().catch(() => false)) {
    const retryButton = page.getByRole('button', { name: /Retry Connection/i })
    await retryButton.click()
    await expect(overlayTitle).toBeHidden({ timeout: 15_000 })
  }
}

const login = async (page: Page) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' })
    await ensureConnection(page)

    const loginReady = page.locator('[data-testid="login-email"], [data-testid="notebook-list"]')
    await expect(loginReady).toBeVisible({ timeout: 30_000 })

    const notebookListVisible = await page.getByTestId('notebook-list').isVisible().catch(() => false)
    if (notebookListVisible || page.url().includes('/notebooks')) {
      return
    }

    const emailInput = page.getByTestId('login-email')
    await expect(emailInput).toBeVisible({ timeout: 30_000 })
    await emailInput.fill(email)
    await expect(emailInput).toHaveValue(email)

    const passwordInput = page.getByTestId('login-password')
    await passwordInput.fill(password)
    await expect(passwordInput).toHaveValue(password)

    const submitButton = page.getByTestId('login-submit')
    await expect(submitButton).toBeEnabled()

    await Promise.all([
      page.waitForURL('**/notebooks', { timeout: 30_000 }),
      submitButton.click(),
    ])

    const listVisible = await page.getByTestId('notebook-list').isVisible().catch(() => false)
    if (listVisible) {
      return
    }
  }

  await expect(page.getByTestId('notebook-list')).toBeVisible()
}

const openNotebook = async (page: Page) => {
  await expect(page.getByTestId('notebook-list')).toBeVisible()

  const notebookCard = notebookId
    ? page.locator(`[data-testid="notebook-card"][data-kb-id="${notebookId}"]`)
    : page.getByTestId('notebook-card').filter({ hasText: notebookName }).first()
  await expect(notebookCard).toBeVisible()
  await notebookCard.click()

  await page.waitForURL('**/notebooks/**')
}

const setupDiagnostics = (
  page: Page,
  testInfo: TestInfo,
  options?: { logUrlIncludes?: string[] }
) => {
  const logs: string[] = []
  const urlFilters = options?.logUrlIncludes ?? ['/sources']
  const shouldLogUrl = (url: string) => urlFilters.some((fragment) => url.includes(fragment))
  const push = (entry: string) => {
    logs.push(`[${new Date().toISOString()}] ${entry}`)
  }

  page.on('console', (msg) => {
    push(`console.${msg.type()}: ${msg.text()}`)
  })
  page.on('pageerror', (error) => {
    push(`pageerror: ${error.message}`)
  })
  page.on('requestfailed', (req) => {
    push(`requestfailed ${req.method()} ${req.url()} ${req.failure()?.errorText ?? 'unknown'}`)
  })
  page.on('request', (req) => {
    if (shouldLogUrl(req.url())) {
      push(`request ${req.method()} ${req.url()}`)
    }
  })
  page.on('response', (resp) => {
    if (shouldLogUrl(resp.url())) {
      push(`response ${resp.status()} ${resp.url()}`)
    }
  })

  return {
    log: push,
    attach: async () => {
      if (logs.length > 0) {
        await testInfo.attach('diagnostics', {
          body: logs.join('\n'),
          contentType: 'text/plain',
        })
      }
    },
  }
}

test('notebook list view toggle + upload flow + notes', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page, testInfo)
  try {
    await login(page)

    await expect(page.locator('[data-testid="notebook-list"][data-view="card"]')).toBeVisible()
    await page.getByTestId('view-select').click()
    await page.getByTestId('view-option-list').click()
    await expect(page.locator('[data-testid="notebook-list"][data-view="list"]')).toBeVisible()
    await page.getByTestId('view-select').click()
    await page.getByTestId('view-option-card').click()
    await expect(page.locator('[data-testid="notebook-list"][data-view="card"]')).toBeVisible()

    await openNotebook(page)
    await ensureConnection(page)

    await expect(page.getByTestId('column-sources')).toBeVisible()
    await expect(page.getByTestId('column-chat')).toBeVisible()
    await expect(page.getByTestId('column-notes')).toBeVisible()
    await expect(page.getByTestId('chat-input')).toBeVisible()
    await expect(page.getByTestId('notes-new')).toBeVisible()

    await page.getByTestId('upload-paste').click()
    await expect(page.getByTestId('upload-dialog')).toBeVisible()
    const pasteText = `Playwright paste source ${Date.now()}`
    const pasteInput = page.getByTestId('upload-paste-input')
    await pasteInput.fill(pasteText)
    await expect(pasteInput).toHaveValue(pasteText)
    const uploadConfirm = page.getByTestId('upload-confirm')
    await expect(uploadConfirm).toBeEnabled()
    const uploadResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/sources') && resp.request().method() === 'POST',
      { timeout: 20_000 }
    )
    await uploadConfirm.click()
    let uploadResponse
    try {
      uploadResponse = await uploadResponsePromise
    } catch (error) {
      const dialogVisible = await page.getByTestId('upload-dialog').isVisible().catch(() => false)
      const confirmDisabled = await uploadConfirm.isDisabled().catch(() => true)
      const inputValue = await pasteInput.inputValue().catch(() => '<unavailable>')
      diagnostics.log(`upload-dialog-visible=${dialogVisible}`)
      diagnostics.log(`upload-confirm-disabled=${confirmDisabled}`)
      diagnostics.log(`upload-paste-value=${inputValue}`)
      throw error
    }
    const uploadStatus = uploadResponse.status()
    if (!uploadResponse.ok()) {
      const responseBody = await uploadResponse.text()
      console.warn(`Upload response status: ${uploadStatus} ${responseBody}`)
    }
    await expect(page.getByTestId('upload-dialog')).toBeHidden()

    await page.getByTestId('upload-file').click()
    await expect(page.getByTestId('upload-dialog')).toBeVisible()
    const uploadFixture = path.resolve(__dirname, 'fixtures', 'upload.txt')
    await page.getByTestId('upload-file-input').setInputFiles(uploadFixture)
    const fileUploadResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/sources') && resp.request().method() === 'POST',
      { timeout: 20_000 }
    )
    await page.getByTestId('upload-confirm').click()
    const fileUploadResponse = await fileUploadResponsePromise
    if (!fileUploadResponse.ok()) {
      const responseBody = await fileUploadResponse.text()
      console.warn(`File upload response status: ${fileUploadResponse.status()} ${responseBody}`)
    }
    await expect(page.getByTestId('upload-dialog')).toBeHidden()

    const sourceToggles = page.locator('[data-testid^="source-toggle-"]')
    if (await sourceToggles.count()) {
      const firstToggle = sourceToggles.first()
      const toggleTestId = await firstToggle.getAttribute('data-testid')
      const sourceId = toggleTestId?.replace('source-toggle-', '')
      const contextRequestPromise = page.waitForRequest((req) =>
        req.url().includes('/chat/context') && req.method() === 'POST'
      )
      const before = (await firstToggle.getAttribute('data-state')) ?? (await firstToggle.getAttribute('aria-checked'))
      await firstToggle.click()
      const after = (await firstToggle.getAttribute('data-state')) ?? (await firstToggle.getAttribute('aria-checked'))
      expect(after).not.toBe(before)
      if (sourceId) {
        const contextRequest = await contextRequestPromise
        const payload = contextRequest.postDataJSON() as {
          context_config?: { sources?: Record<string, string> }
        }
        expect(payload.context_config?.sources?.[sourceId]).toBe('not in')
      }
    }

    await page.getByTestId('notes-new').click()
    const noteContent = `Playwright note ${Date.now()}`
    await page.getByTestId('note-editor').fill(noteContent)
    await page.getByTestId('note-save').click()
    const noteItem = page
      .getByTestId('notes-list')
      .locator('[data-testid^="note-item-"]')
      .filter({ hasText: noteContent })
      .first()
    await expect(noteItem).toBeVisible({ timeout: 20_000 })
  } finally {
    await diagnostics.attach()
  }
})

test('quick note flow', async ({ page }) => {
  await login(page)
  await page.goto(`${baseURL}/quick-note`)

  await expect(page.getByTestId('quick-note-list')).toBeVisible()

  const title = `Playwright Quick Note ${Date.now()}`
  const content = `Quick note content ${Date.now()}`
  await page.getByTestId('quick-note-title').fill(title)
  await page.getByTestId('quick-note-content').fill(content)
  await page.getByTestId('quick-note-save').click()

  const item = page
    .getByTestId('quick-note-list')
    .locator('[data-testid="quick-note-item"]')
    .filter({ hasText: title })
    .first()
  await expect(item).toBeVisible({ timeout: 10_000 })
  await item.click()
  await expect(page.getByTestId('quick-note-title')).toHaveValue(title)
  await expect(page.getByTestId('quick-note-summary')).toHaveAttribute('data-status', 'idle', { timeout: 10_000 })
})

test('share permissions flow', async ({ page }, testInfo) => {
  const diagnostics = setupDiagnostics(page, testInfo, {
    logUrlIncludes: ['/shared', '/knowledge-bases', '/share'],
  })
  try {
    await login(page)
    await page.goto(`${baseURL}/share`)

    await expect(page.getByTestId('share-list')).toBeVisible()

    const createShare = async (permission: 'chat' | 'full') => {
      await page.getByTestId('share-permission-select').click()
      await page
        .locator(`[data-testid="share-permission-option"][data-permission="${permission}"]`)
        .click()

      const response = await Promise.all([
        page.waitForResponse((resp) =>
          resp.url().includes('/knowledge-bases/') &&
          resp.url().includes('/share') &&
          resp.request().method() === 'POST'
        ),
        page.getByTestId('share-generate').click(),
      ])

      const payload = await response[0].json()
      const data = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
      const token = data?.token as string | undefined
      if (!token) {
        throw new Error('Share token missing')
      }
      return `${baseURL}/share/${token}`
    }

    const chatShareUrl = await createShare('chat')
    diagnostics.log(`share-chat-url=${chatShareUrl}`)
    await page.goto(chatShareUrl)
    await ensureConnection(page)
    try {
      await expect(page.getByTestId('share-chat-input')).toBeVisible()
    } catch (error) {
      const shareColumns = page.getByTestId('share-columns')
      const chatColumn = page.getByTestId('share-chat-column')
      diagnostics.log(`share-columns-count=${await shareColumns.count()}`)
      diagnostics.log(`share-columns-visible=${await shareColumns.isVisible().catch(() => false)}`)
      diagnostics.log(`share-chat-column-count=${await chatColumn.count()}`)
      diagnostics.log(`share-chat-column-visible=${await chatColumn.isVisible().catch(() => false)}`)
      diagnostics.log(`share-chat-input-count=${await page.getByTestId('share-chat-input').count()}`)
      diagnostics.log(`share-source-column-count=${await page.locator('[data-testid="share-source-column"]').count()}`)
      diagnostics.log(`share-url=${page.url()}`)
      const html = await page.content().catch(() => '')
      if (html) {
        await testInfo.attach('share-page-snippet', {
          body: html.slice(0, 2000),
          contentType: 'text/plain',
        })
      }
      throw error
    }
    await expect(page.locator('[data-testid="share-source-column"]')).toHaveCount(0)

    await page.goto(`${baseURL}/share`)
    const fullShareUrl = await createShare('full')
    diagnostics.log(`share-full-url=${fullShareUrl}`)
    await page.goto(fullShareUrl)
    await ensureConnection(page)
    await expect(page.getByTestId('share-chat-input')).toBeVisible()
    await expect(page.getByTestId('share-source-column')).toBeVisible()
  } finally {
    await diagnostics.attach()
  }
})
