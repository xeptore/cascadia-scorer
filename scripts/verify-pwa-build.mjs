import { access, readFile, readdir } from 'node:fs/promises'

const configuredBase = process.env.VITE_BASE ?? '/'
const expectedBase =
  configuredBase === '' || configuredBase === '/'
    ? '/'
    : `/${configuredBase.replace(/^\/+|\/+$/g, '')}/`

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'))
const html = await readFile('dist/index.html', 'utf8')
const serviceWorker = await readFile('dist/sw.js', 'utf8')
const clientScripts = await Promise.all(
  (await readdir('dist/assets'))
    .filter((path) => path.endsWith('.js'))
    .map((path) => readFile('dist/assets/' + path, 'utf8')),
)

assert(manifest.start_url === expectedBase, `Unexpected start_url: ${manifest.start_url}`)
assert(manifest.scope === expectedBase, `Unexpected scope: ${manifest.scope}`)
assert(
  html.includes(`${expectedBase}manifest.webmanifest`),
  'The manifest link does not use the configured base.',
)
assert(html.includes(`${expectedBase}assets/`), 'Built assets do not use the configured base.')
assert(
  serviceWorker.includes('createHandlerBoundToURL("index.html")'),
  'Missing offline navigation fallback.',
)
assert(
  clientScripts.every((script) => !/["']\/icon-/.test(script)),
  'A client bundle contains a root-relative icon URL.',
)

for (const icon of manifest.icons) {
  assert(!icon.src.startsWith('/'), `Manifest icon must be relative: ${icon.src}`)
  await access(`dist/${icon.src}`)
  const occurrences = serviceWorker.split(`url:"${icon.src}"`).length - 1
  assert(occurrences === 1, `${icon.src} should appear once in the precache; found ${occurrences}.`)
}

console.log(`Verified PWA build for base ${expectedBase}.`)
