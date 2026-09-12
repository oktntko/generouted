export type Options = {
  pagesDir: string
  source: { routes: string | string[]; modals: string | string[] }
  output: string
  format: boolean
}

export const defaultOptions: Options = {
  pagesDir: './src/pages',
  source: { routes: '', modals: '' },
  output: './src/router.ts',
  format: true,
}
