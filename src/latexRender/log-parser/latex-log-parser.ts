import { ErrorRuleId } from "./HumanReadableLogsRules"

const LOG_WRAP_LIMIT = 79
const LATEX_WARNING_REGEX = /^LaTeX(?:3| Font)? Warning: (.*)$/
const HBOX_WARNING_REGEX = /^(Over|Under)full \\(v|h)box/
const PACKAGE_WARNING_REGEX = /^((?:Package|Class|Module) \b.+\b Warning:.*)$/
// This is used to parse the line number from common latex warnings
const LINES_REGEX = /lines? ([0-9]+)/
// This is used to parse the package name from the package warnings
const PACKAGE_REGEX = /^(?:Package|Class|Module) (\b.+\b) Warning/
const FILE_LINE_ERROR_REGEX = /^([./].*):(\d+): (.*)/

enum STATE {
    NORMAL,
    ERROR,
}
export interface Options{
  fileBaseNames?: RegExp[];
  ignoreDuplicates?: boolean;
}
enum ErrorLevel{
  Error = 'error',
  Warning = 'warning',
  Typesetting = 'typesetting',
}
export interface CurrentError{
  line: number | null;
  file: string|null;
  level: ErrorLevel;
  message: string;
  content?: string;
  raw: string;
  
  ruleId?: ErrorRuleId
  contentDetails?: string[]
  command?: string
  suppressed?: boolean
}
interface File{
  path: string;
  files: File[];
}


export default class LatexParser {
    state: STATE;
    fileBaseNames?: RegExp[];
    ignoreDuplicates?: boolean;
    data: Array<CurrentError>;
    fileStack: Array<File>;
    currentFileList: Array<File>;
    openParens: number;
    readonly latexWarningRegex = LATEX_WARNING_REGEX;
    readonly packageWarningRegex = PACKAGE_WARNING_REGEX;
    readonly packageRegex = PACKAGE_REGEX;
    log: LogText;
    currentError: CurrentError;
    currentLine: string;
    rootFileList: Array<{}>
    currentFilePath: string;
  constructor(text: string, options:Options = {}) {
    this.state = STATE.NORMAL
    this.fileBaseNames = options.fileBaseNames || [/compiles/, /\/usr\/local/]
    this.ignoreDuplicates = options.ignoreDuplicates
    this.data = []
    this.fileStack = []
    this.currentFileList = this.rootFileList = []
    this.openParens = 0
    this.log = new LogText(text)
  }
  getNextLine() {
    const line = this.log.nextLine()
    if (typeof line ==="string")this.currentLine = line
    return line !== false;
  }
  parse() {
    while (this.getNextLine()) {
      if (this.state === STATE.NORMAL) {
        switch (true) {
          case this.currentLineIsError():{
            this.state = STATE.ERROR
            this.currentError = {
              line: null,
              file: this.currentFilePath,
              level: ErrorLevel.Error,
              message: this.currentLine.slice(2),
              content: '',
              raw: this.currentLine + '\n',
            }
            break;
          }
          case this.currentLineIsFileLineError():{
            this.state = STATE.ERROR
            this.parseFileLineError()
            break;
          }
          case !!this.currentLineIsRunawayArgument():
            this.parseRunawayArgumentError()
            break;
          case this.currentLineIsWarning():
            this.parseSingleWarningLine(this.latexWarningRegex)
            break;
          case this.currentLineIsHboxWarning():
            this.parseHboxLine()
            break;
          case this.currentLineIsPackageWarning(): 
            this.parseMultipleWarningLine()
            break;
          default:
            this.parseParensForFilenames()
          
        }
      }
      if (this.state === STATE.ERROR) {
        this.currentError.content += this.log
          .linesUpToNextMatchingLine(/^l\.[0-9]+/)
          .join('\n')
        this.currentError.content += '\n'
        this.currentError.content += this.log
          .linesUpToNextWhitespaceLine(true)
          .join('\n')
        this.currentError.content += '\n'
        this.currentError.content += this.log
          .linesUpToNextWhitespaceLine(true)
          .join('\n')
        this.currentError.raw += this.currentError.content
        const lineNo = this.currentError.raw.match(/l\.([0-9]+)/)
        if (lineNo && this.currentError.line === null) {
          this.currentError.line = parseInt(lineNo[1], 10)
        }
        this.data.push(this.currentError)
        this.state = STATE.NORMAL
      }
    }
    return this.postProcess(this.data)
  }

  currentLineIsError() {
    return (
      this.currentLine[0] === '!' &&
      this.currentLine !==
        '!  ==> Fatal error occurred, no output PDF file produced!'
    )
  }

  currentLineIsFileLineError() {
    return FILE_LINE_ERROR_REGEX.test(this.currentLine)
  }

  currentLineIsRunawayArgument() {
    return this.currentLine.match(/^Runaway argument/)
  }

  currentLineIsWarning() {
    return !!this.currentLine.match(this.latexWarningRegex)
  }

  currentLineIsPackageWarning() {
    return !!this.currentLine.match(this.packageWarningRegex)
  }

  currentLineIsHboxWarning() {
    return !!this.currentLine.match(HBOX_WARNING_REGEX)
  }

  parseFileLineError() {
    const result = this.currentLine.match(FILE_LINE_ERROR_REGEX)
    if(!result) throw new Error("Error parsing file line error")
    this.currentError = {
      line: parseInt(result[2]),
      file: result[1],
      level: ErrorLevel.Error,
      message: result[3],
      content: '',
      raw: this.currentLine + '\n',
    }
  }

  parseRunawayArgumentError() {
    this.currentError = {
      line: null,
      file: this.currentFilePath,
      level: ErrorLevel.Error,
      message: this.currentLine,
      content: '',
      raw: this.currentLine + '\n',
    }
    this.currentError.content += this.log
      .linesUpToNextWhitespaceLine()
      .join('\n')
    this.currentError.content += '\n'
    this.currentError.content += this.log
      .linesUpToNextWhitespaceLine()
      .join('\n')
    this.currentError.raw += this.currentError.content
    const lineNo = this.currentError.raw.match(/l\.([0-9]+)/)
    if (lineNo) {
      this.currentError.line = parseInt(lineNo[1], 10)
    }
    return this.data.push(this.currentError)
  }

  parseSingleWarningLine(prefixRegex: RegExp) {
    const warningMatch = this.currentLine.match(prefixRegex)
    if (!warningMatch) {
      return
    }
    const warning = warningMatch[1]
    const lineMatch = warning.match(LINES_REGEX)
    const line = lineMatch ? parseInt(lineMatch[1], 10) : null
    this.data.push({
      line,
      file: this.currentFilePath,
      level: ErrorLevel.Warning,
      message: warning,
      raw: warning,
    })
  }

  parseMultipleWarningLine() {
    // Some package warnings are multiple lines, let's parse the first line
    let warningMatch = this.currentLine.match(this.packageWarningRegex)
    // Something strange happened, return early
    if (!warningMatch) {
      throw new Error('Error parsing package warning somting strange happened');
    }
    const warningLines: Array<string|null> = [warningMatch[1]]
    let lineMatch = this.currentLine.match(LINES_REGEX)
    let line = lineMatch ? parseInt(lineMatch[1], 10) : null
    const packageMatch = this.currentLine.match(this.packageRegex)
    const packageName = packageMatch?.[1]
    // Regex to get rid of the unnecesary (packagename) prefix in most multi-line warnings
    const prefixRegex = new RegExp(
      '(?:\\(' + packageName + '\\))*[\\s]*(.*)',
      'i'
    )
    // After every warning message there's a blank line, let's use it
    while (this.getNextLine()) {
      if (/^ *$/.test(this.currentLine)) { // Blank line detected
        break; // Exit the loop immediately
      }
      lineMatch = this.currentLine.match(LINES_REGEX)
      line = lineMatch ? parseInt(lineMatch[1], 10) : line
      warningMatch = this.currentLine.match(prefixRegex)
      warningLines.push(warningMatch?.[1]||null)
    }
    const rawMessage = warningLines.join(' ')
    this.data.push({
      line,
      file: this.currentFilePath,
      level: ErrorLevel.Warning,
      message: rawMessage,
      raw: rawMessage,
    })
  }

  parseHboxLine() {
    const lineMatch = this.currentLine.match(LINES_REGEX)
    const line = lineMatch ? parseInt(lineMatch[1], 10) : null
    this.data.push({
      line,
      file: this.currentFilePath,
      level: ErrorLevel.Typesetting,
      message: this.currentLine,
      raw: this.currentLine,
    })
  }

  // Check if we're entering or leaving a new file in this line

  parseParensForFilenames() {
    const pos = this.currentLine.search(/[()]/)
    if (pos !== -1) {
      const token = this.currentLine[pos]
      this.currentLine = this.currentLine.slice(pos + 1)
      if (token === '(') {
        const filePath = this.consumeFilePath()
        if (filePath) {
          this.currentFilePath = filePath
          const newFile:File = {
            path: filePath,
            files: [],
          }
          this.fileStack.push(newFile)
          this.currentFileList.push(newFile)
          this.currentFileList = newFile.files
        } else {
          this.openParens++
        }
      } else if (token === ')') {
        if (this.openParens > 0) {
          this.openParens--
        } else {
          if (this.fileStack.length > 1) {
            this.fileStack.pop()
            const previousFile = this.fileStack[this.fileStack.length - 1]
            this.currentFilePath = previousFile.path
            this.currentFileList = previousFile.files
          }
        }
      }
      // else {
      //		 Something has gone wrong but all we can do now is ignore it :(
      // }
      // Process the rest of the line
      this.parseParensForFilenames()
    }
  }

  consumeFilePath() {
    // Our heuristic for detecting file names are rather crude

    // To contain a file path this line must have at least one / before any '(', ')' or '\'
    if (!this.currentLine.match(/^\/?([^ ()\\]+\/)+/)) {
      return false
    }

    // A file may not contain a '(', ')' or '\'
    let endOfFilePath = this.currentLine.search(/[ ()\\]/)

    // handle the case where there is a space in a filename
    while (endOfFilePath !== -1 && this.currentLine[endOfFilePath] === ' ') {
      const partialPath = this.currentLine.slice(0, endOfFilePath)
      // consider the file matching done if the space is preceded by a file extension (e.g. ".tex")
      if (/\.\w+$/.test(partialPath)) {
        break
      }
      // advance to next space or ) or end of line
      const remainingPath = this.currentLine.slice(endOfFilePath + 1)
      // consider file matching done if current path is followed by any of "()[]
      if (/^\s*["()[\]]/.test(remainingPath)) {
        break
      }
      const nextEndOfPath = remainingPath.search(/[ "()[\]]/)
      if (nextEndOfPath === -1) {
        endOfFilePath = -1
      } else {
        endOfFilePath += nextEndOfPath + 1
      }
    }
    let path
    if (endOfFilePath === -1) {
      path = this.currentLine
      this.currentLine = ''
    } else {
      path = this.currentLine.slice(0, endOfFilePath)
      this.currentLine = this.currentLine.slice(endOfFilePath)
    }
    return path
  }

  postProcess(data: Array<CurrentError>) {
    const all: CurrentError[] = []
    const errorsByLevel: Record<ErrorLevel, CurrentError[]>={
      error: [],
      warning: [],
      typesetting: [],
    }
    const hashes = new Set()

    const hashEntry = (entry: CurrentError) => entry.raw

    data.forEach(item => {
      const hash = hashEntry(item)

      if (this.ignoreDuplicates && hashes.has(hash)) {
        return
      }
      errorsByLevel[item.level]?.push(item)
      all.push(item)
      hashes.add(hash)
    })
    return {
      errors: errorsByLevel[ErrorLevel.Error],
      warnings: errorsByLevel[ErrorLevel.Warning],
      typesetting: errorsByLevel[ErrorLevel.Typesetting],
      all,
      files: this.rootFileList,
    }
  }
}

class LogText {
    row: number;
    text: string;
    lines: string[];
  constructor(text: string) {
    this.text = text
    .replace(/\^\^I/g,'\t')// Replace ^^I with tabs
    .replace(/(\r\n)|\r/g, '\n')// Normalize line endings;
    // Join any lines which look like they have wrapped.
    const wrappedLines = this.text.split('\n')
    this.lines = [wrappedLines[0]]

    for (let i = 1; i < wrappedLines.length; i++) {
      // If the previous line is as long as the wrap limit then
      // append this line to it.
      // Some lines end with ... when LaTeX knows it's hit the limit
      // These shouldn't be wrapped.
      // If the next line looks like it could be an error (i.e. start with a !),
      // do not unwrap the line.
      const prevLine = wrappedLines[i - 1]
      const currentLine = wrappedLines[i]

      if (
        prevLine.length === LOG_WRAP_LIMIT &&
        prevLine.slice(-3) !== '...' &&
        currentLine.charAt(0) !== '!'
      ) {
        this.lines[this.lines.length - 1] += currentLine
      } else {
        this.lines.push(currentLine)
      }
    }
    this.row = 0
  }

  nextLine() {
    this.row++
    if (this.row >= this.lines.length) {
      return false
    } else {
      return this.lines[this.row]
    }
  }

  rewindLine() {this.row--}

  linesUpToNextWhitespaceLine(stopAtError?: boolean) {
    return this.linesUpToNextMatchingLine(/^ *$/, stopAtError)
  }

  linesUpToNextMatchingLine(match: RegExp, stopAtError?: boolean) {
    const lines = []

    while (true) {
      const nextLine = this.nextLine()

      if (nextLine === false) {
        break
      }

      if (stopAtError && nextLine.match(/^! /)) {
        this.rewindLine()
        break
      }

      lines.push(nextLine)

      if (nextLine.match(match)) {
        break
      }
    }

    return lines
  }
}