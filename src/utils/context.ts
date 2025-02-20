import { EditorState, SelectionRange } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Direction, escalateToToken, findLine, findMatchingBracket, findWithDirectionFromPos, getCharacterAtPos, getCloseBracket } from "src/utils/editor_utils";
import { Mode } from "../snippets/options";
import { Environment } from "../snippets/environment";
import { getLatexSuiteConfig } from "../snippets/codemirror/config";
import { syntaxTree } from "@codemirror/language";
export interface Bounds {
	start: number;
	end: number;
}

export class Context {
	state: EditorState;
	mode!: Mode;
	pos: number;
	ranges: SelectionRange[];
	codeblockLanguage: string;
	boundsCache: Map<number, Bounds>;

	static fromState(state: EditorState):Context {
		const ctx = new Context();
		const sel = state.selection;
		ctx.state = state;
		ctx.pos = sel.main.to;
		ctx.ranges = Array.from(sel.ranges).reverse();
		ctx.mode = new Mode();
		ctx.boundsCache = new Map();

		const codeblockLanguage = langIfWithinCodeblock(state);
		const inCode = codeblockLanguage !== null;
		const settings = getLatexSuiteConfig(state);
		const forceMath = codeblockLanguage?settings.forceMathLanguages.contains(codeblockLanguage):false;
		ctx.mode.codeMath = forceMath;
		ctx.mode.code = inCode && !forceMath;
		if (ctx.mode.code&&codeblockLanguage) ctx.codeblockLanguage = codeblockLanguage;
		
		// first, check if math mode should be "generally" on
		const inMath = forceMath || isWithinEquation(state);

		if (inMath && !forceMath) {
			const inInlineEquation = isWithinInlineEquation(state);

			ctx.mode.blockMath = !inInlineEquation;
			ctx.mode.inlineMath = inInlineEquation;
		}

		if (inMath) {
			ctx.mode.textEnv = ctx.inTextEnvironment();
		}

		ctx.mode.text = !inCode && !inMath;

		return ctx;
	}

	static fromView(view: EditorView):Context {
		return Context.fromState(view.state);
	}
	shouldTranslate() {
		const settings = getLatexSuiteConfig(this.state);
		return this.mode.isntInText()&&(!this.mode.code||settings.forceTranslateLanguages.contains(this.codeblockLanguage))
	}
	isWithinEnvironment(pos: number, env: Environment): boolean {
		if (!this.mode.inMath()) return false;

		const bounds = this.getInnerBounds();
		if (!bounds) return false;

		const {start, end} = bounds;
		const text = this.state.sliceDoc(start, end);
		// pos referred to the absolute position in the whole document, but we just sliced the text
		// so now pos must be relative to the start in order to be any useful
		pos -= start;

		const openBracket = env.openSymbol.slice(-1);
		const closeBracket = getCloseBracket(openBracket);

		// Take care when the open symbol ends with a bracket {, [, or (
		// as then the closing symbol, }, ] or ), is not unique to this open symbol
		let offset;
		let openSearchSymbol;

		if (["{", "[", "("].contains(openBracket) && env.closeSymbol === closeBracket) {
			offset = env.openSymbol.length - 1;
			openSearchSymbol = openBracket;
		} else {
			offset = 0;
			openSearchSymbol = env.openSymbol;
		}

		let left = text.lastIndexOf(env.openSymbol, pos - 1);

		while (left != -1) {
			const right = findMatchingBracket(text, left + offset, openSearchSymbol, env.closeSymbol, false);

			if (right === -1) return false;

			// Check whether the cursor lies inside the environment symbols
			if ((right >= pos) && (pos >= left + env.openSymbol.length)) {
				return true;
			}

			if (left <= 0) return false;

			// Find the next open symbol
			left = text.lastIndexOf(env.openSymbol, left - 1);
		}

		return false;
	}

	inTextEnvironment(): boolean {
		return (
			this.isWithinEnvironment(this.pos, {openSymbol: "\\text{", closeSymbol: "}"}) ||
			this.isWithinEnvironment(this.pos, {openSymbol: "\\tag{", closeSymbol: "}"}) ||
			this.isWithinEnvironment(this.pos, {openSymbol: "\\begin{", closeSymbol: "}"}) ||
			this.isWithinEnvironment(this.pos, {openSymbol: "\\end{", closeSymbol: "}"})
		);
	}

	getBounds(pos: number = this.pos): Bounds|null {
		// yes, I also want the cache to work over the produced range instead of just that one through
		// a BTree or the like, but that'd be probably overkill
		if (this.boundsCache.has(pos)) {
			return this.boundsCache.get(pos)||null;
		}

		let bounds;
		if (this.mode.code) {
			// means a codeblock language triggered the math mode -> use the codeblock bounds instead
			bounds = getCodeblockBounds(this.state, pos);
		} else {
			bounds = getEquationBounds(this.state);
		}
		if(bounds)
		this.boundsCache.set(pos, bounds);
		return bounds;
	}

	// Accounts for equations within text environments, e.g. $$\text{... $...$}$$
	getInnerBounds(pos: number = this.pos): Bounds|null {
		let bounds;
		if (this.mode.code) {
			// means a codeblock language triggered the math mode -> use the codeblock bounds instead
			bounds = getCodeblockBounds(this.state, pos);
		} else {
			bounds = getInnerEquationBounds(this.state);
		}

		return bounds;
	}

}

const isWithinEquation = (state: EditorState):boolean => {
	const pos = state.selection.main.to;
	const tree = syntaxTree(state);

	let syntaxNode = tree.resolveInner(pos, -1);
	if (syntaxNode.name.contains("math-end")) return false;

	if (!syntaxNode.parent) {
		syntaxNode = tree.resolveInner(pos, 1);
		if (syntaxNode.name.contains("math-begin")) return false;
	}

	// Account/allow for being on an empty line in a equation
	if (!syntaxNode.parent) {
		const left = tree.resolveInner(pos - 1, -1);
		const right = tree.resolveInner(pos + 1, 1);

		return (left.name.contains("math") && right.name.contains("math") && !(left.name.contains("math-end")));
	}

	return (syntaxNode.name.contains("math"));
}

const isWithinInlineEquation = (state: EditorState):boolean => {
	const pos = state.selection.main.to;
	const tree = syntaxTree(state);

	let syntaxNode = tree.resolveInner(pos, -1);
	if (syntaxNode.name.contains("math-end")) return false;

	if (!syntaxNode.parent) {
		syntaxNode = tree.resolveInner(pos, 1);
		if (syntaxNode.name.contains("math-begin")) return false;
	}

	// Account/allow for being on an empty line in a equation
	if (!syntaxNode.parent) syntaxNode = tree.resolveInner(pos - 1, -1);

	const cursor = syntaxNode.cursor();
	const res = escalateToToken(cursor, Direction.Backward, "math-begin");

	return !res?.name.contains("math-block");
}

/**
 * Figures out where this equation starts and where it ends.
 *
 * **Note:** If you intend to use this directly, check out Context.getBounds instead, which caches and also takes care of codeblock languages which should behave like math mode.
 */
export const getEquationBounds = (state: EditorState, pos?: number):Bounds|null => {
	if (!pos) pos = state.selection.main.to;
	const tree = syntaxTree(state);

	let syntaxNode = tree.resolveInner(pos, -1);

	if (!syntaxNode.parent) {
		syntaxNode = tree.resolveInner(pos, 1);
	}

	// Account/allow for being on an empty line in a equation
	if (!syntaxNode.parent) syntaxNode = tree.resolveInner(pos - 1, -1);

	const cursor = syntaxNode.cursor();
	const begin = escalateToToken(cursor, Direction.Backward, "math-begin");
	const end = escalateToToken(cursor, Direction.Forward, "math-end");

	if (begin && end) {
		return {start: begin.to, end: end.from};
	}
	else {
		return null;
	}
}

// Accounts for equations within text environments, e.g. $$\text{... $...$}$$
const getInnerEquationBounds = (state: EditorState, pos?: number):Bounds|null => {
	if (!pos) pos = state.selection.main.to;
	let text = state.doc.toString();

	// ignore \$
	text = text.replaceAll("\\$", "\\R");

	const left = text.lastIndexOf("$", pos-1);
	const right = text.indexOf("$", pos);

	if (left === -1 || right === -1) return null;

	return {start: left + 1, end: right};
}
export const getHtmlBounds= (state: EditorState, pos: number = state.selection.main.from):Bounds|null => {
	const tree = syntaxTree(state);
	let cursor = tree.cursorAt(pos, -1);
	const blockBegin = escalateToToken(cursor, Direction.Backward, "html-begin");

	cursor = tree.cursorAt(pos, -1);
	const blockEnd = escalateToToken(cursor, Direction.Forward, "html-end");
	if(blockBegin&&blockEnd)
		return { start: blockBegin.from, end: blockEnd.to };
	if (blockBegin&&!blockEnd)
	return { start: blockBegin.from, end: state.doc.length };
	return null
}
/**
 * Figures out where this codeblock starts and where it ends.
 *
 * **Note:** If you intend to use this directly, check out Context.getBounds instead, which caches and also takes care of codeblock languages which should behave like math mode.
 */
const getCodeblockBounds = (state: EditorState, pos: number = state.selection.main.from):Bounds|null => {
	const tree = syntaxTree(state);

	let cursor = tree.cursorAt(pos, -1);
	const blockBegin = escalateToToken(cursor, Direction.Backward, "HyperMD-codeblock-begin");

	cursor = tree.cursorAt(pos, -1);
	const blockEnd = escalateToToken(cursor, Direction.Forward, "HyperMD-codeblock-end");
	if (blockBegin&&blockEnd)
	return { start: blockBegin.to + 1, end: blockEnd.from - 1 };
	return null
}

export const findFirstNonNewlineBefore = (state: EditorState, pos: number): number => {
    let currentPos = pos;
    while (currentPos >= 0) {
        const char = getCharacterAtPos(state, currentPos-1);
        if (char !== "\n") {
            return currentPos;
        }
        currentPos--;
    }
    return 0;
};

//The position I get has.to be.at least one line.before the head of the code block
const langIfWithinCodeblock = (state: EditorState): string | null => {

	const tree = syntaxTree(state);

	const pos = state.selection.ranges[0].from;
	const adjustedPos =pos === 0 ? 0 : findFirstNonNewlineBefore(state, pos);
	const cursor = tree.cursorAt(adjustedPos, -1);
	const inCodeblock = cursor.name.contains("codeblock");
	
	if (!inCodeblock) return null;
	

	// locate the start of the block
	const codeblockBegin = findLine(state,state.doc.lineAt(pos).number,Direction.Backward,/^\`\`\`/)
	
	if (codeblockBegin == null) {
		if(!state.doc.lineAt(pos).text.startsWith("```"))
			console.warn("unable to locate start of the codeblock even though inside one");
		return "";
	}

	// extract the language
	// codeblocks may start and end with an arbitrary number of backticks
	const language = codeblockBegin.text.replace(/`+/, "");
	return language;
}


export function findNearestBlockBoundary(state: EditorState, pos: number, dir: Direction): number {
	const getBoundaryPosition = (node: { from: number; to: number } | number | null) => {
		if (node == null) return dir === Direction.Backward ? 0 : state.doc.length;
		return typeof node === "number" ? node : (dir === Direction.Backward ? node.to : node.from);
	};

	// Ensure regex indexing is safe
	const regexIndex = dir === Direction.Backward ? 0 : 1;

	const boundaries = [
		findLine(state, state.doc.lineAt(pos).number, dir, /^\`\`\`/),
		findWithDirectionFromPos(state.doc.toString(), [/\$(?!\s)/,/(?!\s)\$/][regexIndex], pos, dir),
		findWithDirectionFromPos(state.doc.toString(), [/\<(?!\s)/, /(?!\s)\>/][regexIndex], pos, dir),
	].map(node => getBoundaryPosition(node));

	console.log("Boundaries found:", boundaries);

	// Filter out invalid results before finding max/min
	const validBoundaries = boundaries.filter(b => b !== null && b !== undefined);

	if (validBoundaries.length === 0) return dir === Direction.Backward ? 0 : state.doc.length;

	return dir === Direction.Backward ? Math.max(...validBoundaries) : Math.min(...validBoundaries);
}

  