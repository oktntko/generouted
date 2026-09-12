import { writeFileSync } from 'fs'
import path from 'path'
import fg from 'fast-glob'

import { createPatterns, getRoutes } from '@generouted/core'

import { format } from './format'
import { Options } from './options'
import { template } from './template'

const patterns = Object.assign(createPatterns(), {
  param: [/\[([^\]]+)\]/g, '$$$1'],
  optional: [/^-(\$?[\w-]+)/, '$1?'],
}) as Record<string, [RegExp, string]>

const generateRoutes = async (options: Options) => {
  const source = [`${options.pagesDir}/**/[\\w[-]*.{jsx,tsx}`]
  const files = await fg(source, { onlyFiles: true })
  const routePatterns = { ...patterns, route: createPatterns(options.pagesDir).route }
  const generatedOutput = path.join('./src', options.output)
  const relativeModule = (key: string) => {
    const file = path.relative(path.dirname(generatedOutput), key).replace(/\\/g, '/')
    return `./${file.replace(/\.(jsx|tsx|mdx)$/, '')}`.replace(/^\.\/\.\//, '../')
  }

  const imports: string[] = []
  const modules: string[] = []

  const { routes, preserved, exports, count } = getRoutes(
    files,
    (key, exports, _id = '') => {
      const { loader, action, pending, catch_ } = exports
      const file = key.replace(...routePatterns.route)
      const module = `import('${relativeModule(key)}')`
      const path = file
        .replace(...patterns.splat)
        .replace(...patterns.param)
        .replace(/\(|\)|\/?_layout/g, '')
        .replace(/\/?index|\./g, '/')
        .replace(/(\w)\/$/g, '$1')
        .split('/')
        .map((segment) => segment.replace(...patterns.optional))
        .join('/')

      const ignore = '\n// @ts-ignore\n'
      return {
        _path: path.length > 1 ? `/${path}` : path,
        _module: module,
        _loader: loader ? `${ignore} loader: (...args) => ${module}.then((m) => m.Loader(...args))` : '',
        _action: action ? '' : '',
        _component: 'component: m.default',
        _pendingComponent: pending ? 'pendingComponent: m.Pending' : '',
        _errorComponent: catch_ ? 'errorComponent: m.Catch' : '',
      }
    },
    routePatterns,
  )

  if (preserved._app && exports['_app'].default) {
    imports.push(`import App from '${relativeModule(`${options.pagesDir}/_app.tsx`)}'`)
    modules.push(`const root = createRootRoute({ component: App || Outlet })`)
  } else {
    modules.push(`const root = createRootRoute({ component: Outlet })`)
  }

  if (preserved._404 && exports['404'].default) {
    imports.push(`import NoMatch from '${relativeModule(`${options.pagesDir}/404.tsx`)}'`)
    modules.push(`const _404 = createRoute({ getParentRoute: () => root, path: '*', component: NoMatch || Fragment })`)
  } else {
    modules.push(`const _404 = createRoute({ getParentRoute: () => root, path: '*', component:  Fragment })`)
  }

  const config = JSON.stringify(routes, function (key, value) {
    if (key === 'id') {
      const { id, pid, path, ...props } = this
      const meta = props as (typeof routes)[number]

      const components = [meta._component, meta._pendingComponent, meta._errorComponent].filter(Boolean)
      const options = [path ? `path: '${path}'` : `id: '${id}'`, meta._loader, meta._action].filter(Boolean)
      const module = `const ${id} = createRoute({ getParentRoute: () => ${pid}, ${options.join(', ')} })`

      modules.push(
        meta._module
          ? `${module}.lazy(() =>\n  ${meta._module}.then((m) => createLazyRoute('${meta._path}')({ ${components.join(', ')} }))\n)`
          : module,
      )
    }

    if (['pid', 'path'].includes(key) || key.startsWith('_')) return undefined
    return value
  })
    .replace(/"id":"([\w-]+)"/g, '$1')
    .replace(/^\[|\]$|{|}/g, '')
    .replace(/\[/g, '([')
    .replace(/\]/g, '])')
    .replace(/,"children":/g, '.addChildren')
    .replace(/\),/g, '),\n  ')

  const content = template
    .replace('// imports', imports.join('\n'))
    .replace('// modules', modules.join('\n'))
    .replace('// config', config)

  return { content, count }
}

let latestContent = ''

export const generate = async (options: Options) => {
  const start = Date.now()
  const { content, count } = await generateRoutes(options)
  console.log(`${new Date().toLocaleTimeString()} [generouted] ${count} routes in ${Date.now() - start} ms`)

  if (latestContent === content) return
  latestContent = content

  writeFileSync(`./src/${options.output}`, content)
  if (options.format) format(`./src/${options.output}`)
}
