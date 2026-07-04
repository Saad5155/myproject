// TERMINAL X — full UI QA sweep (demo mode). Prints PASS/FAIL per check.
import { chromium } from 'playwright-core'
const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = 'http://localhost:3002'
const results = []
const consoleErrs = []
const t = (name, ok, note='') => { results.push({name, ok, note}); console.log((ok?'PASS':'FAIL')+'  '+name+(note?' — '+note:'')) }

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })

// ---------- PWA endpoints ----------
for (const p of ['/manifest.webmanifest','/sw.js','/favicon.svg','/icons/icon-192.png']) {
  const r = await fetch(BASE+p); t('PWA asset '+p, r.status===200, String(r.status))
}

// ---------- API contract ----------
{
  const r = await fetch(BASE+'/api/quotes',{method:'POST',headers:{'content-type':'application/json'},body:'{"symbols":[]}'})
  t('quotes empty array → 200 {}', r.status===200)
  const r2 = await fetch(BASE+'/api/deepdive',{method:'POST',headers:{'content-type':'application/json'},body:'{"symbol":"$$bad$$"}'})
  t('deepdive invalid symbol → 400', r2.status===400)
  const r3 = await fetch(BASE+'/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})
  t('ai missing prompt → 400', r3.status===400)
}

// ---------- DESKTOP ----------
const d = await browser.newContext({ viewport: { width: 1512, height: 950 } })
const pg = await d.newPage()
pg.on('console', m => { if (m.type()==='error') consoleErrs.push('desktop: '+m.text()) })
pg.on('pageerror', e => consoleErrs.push('desktop pageerror: '+e.message))
await pg.goto(BASE+'/', { waitUntil: 'networkidle' })
await pg.waitForTimeout(1200)

// klaxon fires (LLY 1122 < alert 1150) and dismisses
t('alert klaxon fires on open', await pg.locator('.klaxon').count() === 1)
await pg.locator('.klaxon button').click()
t('klaxon dismisses', await pg.locator('.klaxon').count() === 0)

// login redirect in demo
{
  const r = await fetch(BASE+'/login', { redirect: 'manual' })
  t('demo /login redirects home', r.status===307||r.status===308||r.status===302)
}

// portfolio: computed stats present
t('portfolio P/L computed', (await pg.locator('.panel', {hasText:'PORTFOLIO'}).first().textContent()).includes('Open P/L'))
t('quote DEMO badges shown', await pg.locator('.src.stale').count() > 0)

// manual add + delete position
await pg.locator('button', { hasText: 'MANUAL' }).click()
await pg.locator('input[placeholder="TICKER"]').first().fill('AAPL')
await pg.locator('input[placeholder="SHARES"]').fill('2')
await pg.locator('input[placeholder="BUY $"]').fill('220')
await pg.locator('.panel', {hasText:'PORTFOLIO'}).first().locator('button', { hasText: 'ADD' }).click()
await pg.waitForTimeout(400)
t('manual position added', (await pg.locator('table.tbl td', {hasText:'AAPL'}).count()) > 0)
// delete it
const aaplRow = pg.locator('tr.tickerrow', { hasText: 'AAPL' })
await aaplRow.locator('span.red').click()
await pg.waitForTimeout(300)
t('position deleted', (await pg.locator('tr.tickerrow', {hasText:'AAPL'}).count()) === 0)

// paste import flow (canned parse)
await pg.locator('button', { hasText: 'Paste' }).click()
await pg.locator('textarea').fill('10 JPM at 329, 5 RTX 190')
await pg.locator('button', { hasText: 'PARSE' }).click()
await pg.waitForSelector('text=Confirm parsed positions', { timeout: 8000 })
t('paste → AI parse → confirm sheet', true)
await pg.locator('button', { hasText: 'DISCARD' }).click()

// alerts add + toggle + delete
const alertsPanel = pg.locator('.panel', { hasText: 'ALERTS' }).first()
await alertsPanel.locator('input[placeholder="TICKER"]').fill('MSFT')
await alertsPanel.locator('input[placeholder="PRICE"]').fill('600')
await alertsPanel.locator('button', { hasText: 'SET' }).click()
await pg.waitForTimeout(300)
t('alert added', (await alertsPanel.locator('td', {hasText:'MSFT'}).count()) > 0)
await alertsPanel.locator('tr', {hasText:'MSFT'}).locator('text=● ARMED').click()
t('alert toggles off', (await alertsPanel.locator('tr', {hasText:'MSFT'}).locator('text=○ OFF').count()) === 1)
await alertsPanel.locator('tr', {hasText:'MSFT'}).locator('span.red').click()
t('alert deleted', (await alertsPanel.locator('td', {hasText:'MSFT'}).count()) === 0)

// F9 opens settings (F1-F8 are the 8 panels)
await pg.keyboard.press('F9')
await pg.waitForTimeout(400)
t('F9 opens settings modal', (await pg.locator('.modal', {hasText:'Settings'}).count()) === 1)
t('settings shows DEMO MODE status', (await pg.locator('.modal').textContent()).includes('DEMO MODE'))
await pg.keyboard.press('Escape')
t('ESC closes settings', (await pg.locator('.modal').count()) === 0)

// news wire refresh
await pg.locator('button', { hasText: 'REFRESH WIRE' }).click()
await pg.waitForTimeout(800)
t('news wire populates with sentiment tags', (await pg.locator('.tag.bull').count()) > 0)

// calendar populate
await pg.locator('button', { hasText: 'POPULATE' }).click()
await pg.waitForTimeout(800)
t('calendar countdown items', (await pg.locator('.cal-cd .num').count()) >= 3)

// screener run
await pg.locator('input[placeholder*="TICKER to screen"]').fill('NVDA')
await pg.locator('.panel', {hasText:'MY SCREENER'}).locator('button', {hasText:'RUN'}).click()
await pg.waitForTimeout(1200)
t('screener verdict renders', (await pg.locator('.panel', {hasText:'MY SCREENER'}).textContent()).includes('rules passed'))

// command line
await pg.locator('.cmdrow input').fill('news on RTX')
await pg.locator('.cmdrow input').press('Enter')
await pg.waitForTimeout(900)
t('command line answers', (await pg.locator('.term-out.green').count()) > 0)

// global search autocomplete → deep dive
await pg.locator('button', { hasText: 'SEARCH' }).click()
await pg.waitForTimeout(200)
t('global search modal opens', (await pg.locator('.modal', {hasText:'Search'}).count()) === 1)
t('search modal shows markets snapshot', (await pg.locator('.modal', {hasText:'MARKETS SNAPSHOT'}).count()) === 1)
await pg.locator('.modal .tsearch-input').fill('IBM')
await pg.waitForTimeout(500)
t('autocomplete returns results', (await pg.locator('.modal .tsearch-drop .tsearch-item').count()) >= 1)
await pg.locator('.modal .tsearch-input').press('Enter')
await pg.waitForTimeout(300)
t('search modal closes on select', (await pg.locator('.modal').count()) === 0)
await pg.waitForSelector('text=MY SCREENER VERDICT', { timeout: 15000 })
t('deep dive report renders', true)
t('price chart renders', (await pg.locator('.recharts-area-area').count()) >= 1)
t('deep dive source badges', (await pg.locator('.panel', {hasText:'COMPANY DEEP DIVE'}).locator('.src').count()) >= 2)
t('TradingView link', (await pg.locator('a[href*="tradingview.com/chart"]').count()) === 1)
await pg.locator('button', { hasText: 'SAVE CARD' }).click()
await pg.waitForTimeout(500)
t('save card → SAVED state', (await pg.locator('button', {hasText:'✓ SAVED'}).count()) === 1)
t('toast appears', (await pg.locator('.toast').count()) >= 1)

// morning brief
await pg.locator('button', { hasText: 'MORNING BRIEF' }).click()
await pg.waitForSelector('text=WHAT MATTERS TODAY', { timeout: 20000 })
t('morning brief completes', true)
t('brief shows alert hits', (await pg.locator('.modal').textContent()).includes('HIT'))
await pg.keyboard.press('Escape')

// watchlist add / remove
const wl = pg.locator('.panel', { hasText: 'WATCHLIST' })
const wlBefore = await wl.locator('tbody tr').count()
await wl.locator('.tsearch-input').fill('nvda')
await pg.waitForTimeout(500)
await wl.locator('.tsearch-input').press('Enter')
await pg.waitForTimeout(500)
t('watchlist add works', (await wl.locator('tbody tr').count()) === wlBefore + 1)
await wl.locator('tr', { hasText: 'NVDA' }).locator('span.red').click()
await pg.waitForTimeout(300)
t('watchlist remove works', (await wl.locator('tbody tr').count()) === wlBefore)

// macro tape
t('macro tape items render', (await pg.locator('.tape-item').count()) >= 8)

// sign out button exists (demo: no-op redirect)
t('EXIT button present', (await pg.locator('button', {hasText:'EXIT'}).count()) === 1)
await d.close()

// ---------- MOBILE ----------
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const mp = await m.newPage()
mp.on('console', x => { if (x.type()==='error') consoleErrs.push('mobile: '+x.text()) })
mp.on('pageerror', e => consoleErrs.push('mobile pageerror: '+e.message))
await mp.goto(BASE+'/', { waitUntil: 'networkidle' })
await mp.waitForTimeout(1000)
if (await mp.locator('.klaxon').count()) await mp.locator('.klaxon button').click()
t('mobile: 8 tabs', (await mp.locator('.mtab').count()) === 8)
t('mobile: single panel layout', (await mp.locator('.single .panel').count()) === 1)
// tab through all 7 panels
for (const tab of ['RESEARCH','WIRE','SCREEN','ALERTS','CAL','DEEP DIVE','WATCH','PORTFOLIO']) {
  await mp.locator('.mtab', { hasText: tab }).click()
  await mp.waitForTimeout(200)
}
t('mobile: all tabs switch without error', true)
// swipe left → next panel
await mp.locator('.mtab', { hasText: 'PORTFOLIO' }).click()
await mp.waitForTimeout(200)
const box = await mp.locator('.single').boundingBox()
await mp.touchscreen.tap(box.x+300, box.y+200) // warm
await mp.locator('.single').dispatchEvent('touchstart', { touches: [{clientX: 350, clientY: 400, identifier: 1}], changedTouches: [{clientX: 350, clientY: 400, identifier: 1}] })
await mp.locator('.single').dispatchEvent('touchend', { touches: [], changedTouches: [{clientX: 120, clientY: 405, identifier: 1}] })
await mp.waitForTimeout(300)
t('mobile: swipe navigates to next panel', (await mp.locator('.mtab.active').textContent()).includes('RESEARCH'))
// touch targets ≥ 38px
const th = await mp.locator('.mtab').first().boundingBox()
t('mobile: tab touch target height ≥ 38px', th.height >= 38, Math.round(th.height)+'px')
await m.close()

await browser.close()
const fails = results.filter(r=>!r.ok)
console.log('\n========== QA SWEEP: ' + (results.length-fails.length) + '/' + results.length + ' passed ==========')
if (consoleErrs.length) { console.log('CONSOLE/PAGE ERRORS:'); consoleErrs.forEach(e=>console.log('  '+e)) } else console.log('No console/page errors.')
process.exit(fails.length ? 1 : 0)
