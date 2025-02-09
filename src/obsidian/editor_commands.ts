import { Editor } from "obsidian";
import { EditorView } from "@codemirror/view";
import { replaceRange, setCursor, setSelection } from "../utils/editor_utils";
import Moshe from "src/main";
import { Context } from "src/utils/context";
import { MathPraiser } from "src/mathParser/mathEngine";


function boxCurrentEquation(view: EditorView) {
	const ctx = Context.fromView(view);
	const result = ctx.getBounds();
	if (!result) return false;
	const {start, end} = result;

	let equation = "\\boxed{" + view.state.sliceDoc(start, end) + "}";


	// // Insert newlines if we're in a block equation
	const insideBlockEqn = view.state.sliceDoc(start-2, start) === "$$" && view.state.sliceDoc(end, end+2) === "$$";

	if (insideBlockEqn) equation = "\n" + equation + "\n";


	const pos = view.state.selection.main.to;
	replaceRange(view, start, end, equation);
	setCursor(view, pos + "\\boxed{".length + (insideBlockEqn ? 1 : 0));
}


function getBoxEquationCommand() {
	return {
		id: "moshe-box-equation",
		name: "Box current equation",
		editorCheckCallback: (checking: boolean, editor: Editor) => {

			// @ts-ignore
			const view = editor.cm;
			const ctx = Context.fromView(view);
			const withinEquation = ctx.mode.inMath();

			if (checking) return withinEquation;
			if (!withinEquation) return;

			boxCurrentEquation(view);

			return;

		},
	}
}


function getSelectEquationCommand() {
	return {
		id: "moshe-select-equation",
		name: "Select current equation",
		editorCheckCallback: (checking: boolean, editor: Editor) => {

			// @ts-ignore
			const view = editor.cm;
			const ctx = Context.fromView(view);
			const withinEquation = ctx.mode.inMath();

			if (checking) return withinEquation;
			if (!withinEquation) return;


			const result = ctx.getBounds();
			if (!result) return false;
			let {start, end} = result;

			// Don't include newline characters in the selection
			const doc = view.state.doc.toString();

			if (doc.charAt(start) === "\n") start++;
			if (doc.charAt(end - 1) === "\n") end--;


			setSelection(view, start, end);

			return;
		},
	}
}


function getEnableAllFeaturesCommand(plugin: Moshe) {
	return {
		id: "moshe-enable-all-features",
		name: "Enable all features",
		callback: async () => {
			plugin.settings.snippetsEnabled = true;
			plugin.settings.matrixShortcutsEnabled = true;
			plugin.settings.taboutEnabled = true;
			plugin.settings.autoEnlargeBrackets = true;

			await plugin.saveSettings();
		},
	}
}


function getDisableAllFeaturesCommand(plugin: Moshe) {
	return {
		id: "moshe-disable-all-features",
		name: "Disable all features",
		callback: async () => {
			plugin.settings.snippetsEnabled = false;
			plugin.settings.matrixShortcutsEnabled = false;
			plugin.settings.taboutEnabled = false;
			plugin.settings.autoEnlargeBrackets = false;

			await plugin.saveSettings();
		},
	}
}

function getTranslateFromMathjaxToLatex(plugin: Moshe) {
	return {
		id: "moshe-translate-from-mathjax-to-latex",
		name: "Translate from MathJax to LaTeX",
		callback: async () => {
			console.log("Hello from callback");

			await plugin.saveSettings();
		},
		editorCallback: (editor: Editor) => {
			return mathjaxToLatex(String.raw`1+\sin (32)*7.06* \frac{x}{\cos (32)*7.06}-5\left(  \frac{x}{\cos (32)*7.06} \right)^{2}`)
			// @ts-ignore
			const view = editor.cm;
			if (!view) return;

			const ctx = Context.fromView(view);
			const {from, to} = view.state.selection.main;

			if(ctx.mode.inMath(),from !== to){
				console.log('in math');
				const result = ctx.getBounds();
				if (!result) return false;

				const doc = view.state.doc.toString();
				mathjaxToLatex(doc.slice(from, to));
			}
			else {
				console.log('not in math',navigator.clipboard.readText());
				navigator.clipboard.readText().then((string) => {
					mathjaxToLatex(string);
				}).catch((error) => {
					console.error("Failed to read clipboard: ", error);
				});;
			}
			function mathjaxToLatex(math: string) {
				console.log('math: ',math);
				const a = new MathPraiser();
				a.setInput(math);

				console.log(a.getMathGroup());
			}
		}
	};
}


export const getEditorCommands = (plugin: Moshe) => {
	return [
		getTranslateFromMathjaxToLatex(plugin),
		getBoxEquationCommand(),
		getSelectEquationCommand(),
		getEnableAllFeaturesCommand(plugin),
		getDisableAllFeaturesCommand(plugin)
	];
};
