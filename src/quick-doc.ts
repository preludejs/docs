import * as S from '@prelude/string'
import Fs from 'fs'
import Ts from 'typescript'

export type QuickDoc = {
  fileNames: string[],
  compilerOptions: Ts.CompilerOptions,
  host: Ts.LanguageServiceHost,
  service: Ts.LanguageService,
  program: Ts.Program,
  checker: Ts.TypeChecker
}

export type t = QuickDoc

export const of =
  ({ fileNames = process.argv.slice(2) } = {}): QuickDoc => {
    const compilerOptions: Ts.CompilerOptions = {}
    const host: Ts.LanguageServiceHost = {
      getScriptFileNames: () => fileNames,
      getScriptVersion: () => '0',
      getScriptSnapshot: fileName =>
        Fs.existsSync(fileName) ?
          Ts.ScriptSnapshot.fromString(Fs.readFileSync(fileName, 'utf8')) :
          undefined,
      getCurrentDirectory: () => process.cwd(),
      getCompilationSettings: () => compilerOptions,
      getDefaultLibFileName: options => Ts.getDefaultLibFilePath(options),
      fileExists: Ts.sys.fileExists,
      readFile: Ts.sys.readFile,
      readDirectory: Ts.sys.readDirectory,
      directoryExists: Ts.sys.directoryExists,
      getDirectories: Ts.sys.getDirectories,
    }
    const service = Ts.createLanguageService(host, Ts.createDocumentRegistry())
    const program = Ts.createProgram(fileNames, compilerOptions)
    const checker = program.getTypeChecker()
    return {
      fileNames,
      compilerOptions,
      host,
      service,
      program,
      checker
    }
  }

const stringOfSymbolDisplayParts =
  (tokens: Ts.SymbolDisplayPart[]): string =>
    tokens.map(_ => _.text).join('')

const stringOfJsTagInfo =
  ({ name, text: tokens }: Ts.JSDocTagInfo): string =>
    `${S.upperFirst(name)} ${stringOfSymbolDisplayParts(tokens ?? [])}`

const visitOf =
  ({ checker, service }: QuickDoc, sourceFile: Ts.SourceFile) => {
    const visit =
      (node: Ts.Node) => {
        if (Ts.isExportDeclaration(node)) {
          Ts.forEachChild(node, visit)
          return
        }

        if (Ts.isNamedExports(node)) {
          Ts.forEachChild(node, visit)
          return
        }

        if (Ts.isExportSpecifier(node)) {
          const name = node.name.text
          const type = checker.getTypeAtLocation(node)
          const typeString = checker.typeToString(type)
          const quickInfo = service.getQuickInfoAtPosition(sourceFile.fileName, node.end)
          console.log(`* \`${name}: ${typeString}\``)
          // console.log(type.getSymbol())
          // for (const _ of type.getSymbol()?.getDeclarations() ?? []) {
          //   console.log(_.getText())
          // }
          console.log()
          const paragraphs = [
            S.indent(stringOfSymbolDisplayParts(quickInfo?.documentation ?? []), '  ')
          ]
          for (const tag of quickInfo?.tags ?? []) {
            paragraphs.push(S.indent(stringOfJsTagInfo(tag), '  '))
          }
          process.stdout.write(
            paragraphs
              .filter(_ => !S.blank(_))
              .map(_ => _ + '\n\n')
              .join('')
          )
          return
        }

        if (Ts.isModuleDeclaration(node)) {
          Ts.forEachChild(node, visit)
          return
        }

        if (Ts.isTypeAliasDeclaration(node)) {
          // console.log(node.name.escapedText)
          return
        }

        if (Ts.isVariableStatement(node)) {
          Ts.forEachChild(node, visit)
          return
        }

        // console.log('UNKNOWN', Ts.SyntaxKind[node.kind])
      }
    return visit
  }

export const print =
  (doc: QuickDoc) => {
    for (const sourceFile of doc.program.getSourceFiles()) {
      if (!sourceFile.isDeclarationFile) {
        Ts.forEachChild(sourceFile, visitOf(doc, sourceFile))
      }
    }
  }

print(of())
