import path from 'path'
import { Plugin } from 'vite'

import { generate } from './generate'
import { defaultOptions, Options } from './options'

export default function Generouted(options?: Partial<Options>): Plugin {
  const resolvedOptions = { ...defaultOptions, ...options }
  const pagesDir = `/${resolvedOptions.pagesDir
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\/$/, '')}`

  return {
    name: 'generouted/solid-router',
    enforce: 'pre',
    transform(code, id) {
      if (pagesDir === '/src/pages' || !id.includes('generouted') || !code.includes('/src/pages')) return

      const escapedPagesDir = pagesDir.replaceAll('/', '\\/')
      const transformed = code.replaceAll('/src/pages', pagesDir).replaceAll('\\/src\\/pages', escapedPagesDir)
      return transformed === code ? undefined : { code: transformed, map: null }
    },
    configureServer(server) {
      const pagesPath = path.resolve(resolvedOptions.pagesDir) + path.sep
      const listener = (file = '') => (file.startsWith(pagesPath) ? generate(resolvedOptions) : null)
      server.watcher.on('add', listener)
      server.watcher.on('change', listener)
      server.watcher.on('unlink', listener)
    },
    buildStart(): Promise<void> {
      return generate(resolvedOptions)
    },
  }
}
