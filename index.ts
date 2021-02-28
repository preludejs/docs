import { highlight } from 'highlight.js'
import { Parser, HtmlRenderer, Node } from 'commonmark'
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, lstatSync } from 'fs'
import { join as joinPath } from 'path'

const parser = new Parser
const renderer = new HtmlRenderer

/** @returns highlighted html. */
const htmlOfSrc =
  (lang: null | string, src: null | string): string =>
    lang && src ?
      '<pre>' + highlight(lang, src).value + '</pre>' :
      src || ''

/** @returns html of markdown. */
const htmlOfMd =
  (md: string): string => {
    const ast = parser.parse(md)
    const walker = ast.walker()
    let event
    while ((event = walker.next())) {
      const { node } = event
      switch (node.type) {
        case 'code_block': {
          if (event.entering) {
            const htmlBlock = new Node('html_block')
            htmlBlock.literal = htmlOfSrc(node.info, node.literal)
            node.insertBefore(htmlBlock)
            node.unlink()
          }
          break
        }
      }
    }
    const inner = renderer.render(ast)
    return `
      <html>
        <head>
          <link rel="stylesheet" href="https://unpkg.com/highlight.js/styles/github.css" />
          <link rel="stylesheet" href="https://unpkg.com/latex.css/style.min.css" />
        </head>
        <body>
          ${inner}
        </body>
      </html>
      `
  }

/** @returns list of .md files in directory. */
const mdFiles =
  (dir: string): string[] =>
    readdirSync(dir)
      .filter(_ => _.endsWith('.md'))
      .map(_ => _.slice(0, -3))

/** @returns path with suffix. */
const withSuffix =
  (path: string, suffix: string): string =>
    path.endsWith(suffix) ?
      path :
      path + suffix

/** @returns markdown file contents. */
const mdOf =
  (path) =>
    readFileSync(withSuffix(path, '.md'), 'utf8')

/** @returns html of markdown file. */
const htmlOf =
  (path: string): string =>
    htmlOfMd(mdOf(path))

/** @returns writes html content to a file. */
const writeHtml =
  (path: string, content: string): void =>
    writeFileSync(`./docs/` + withSuffix(path, '.html'), content)

/** @returns directories in directory. */
const dirs =
  (dir = '.'): string[] =>
    readdirSync(dir)
      .filter(_ => lstatSync(joinPath(dir, _)).isDirectory())

const dirsWithMd =
  (dir = '.'): string[] =>
    dirs(dir)
      .filter(_ => mdFiles(joinPath(dir, _)).length)

const generate =
  (): void => {
    writeHtml('index', htmlOf('Readme'))
    for (const dir of dirsWithMd()) {
      if (!existsSync(`./docs/${dir}`)) {
        mkdirSync(`./docs/${dir}`)
      }
      for (const md of mdFiles(dir)) {
        writeHtml(`${dir}/${md}`, htmlOf(`${dir}/${md}`))
      }
    }
  }

export default generate
