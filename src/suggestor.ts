import NumeralsPlugin from "./main";
import {
    EditorSuggest,
    EditorPosition,
    Editor,
    TFile,
    EditorSuggestTriggerInfo,
    EditorSuggestContext,
    setIcon,
 } from "obsidian";

import { getMathJsSymbols } from "./utilities";



const numeralsDirectives = [
	"@hideRows",
	"@Sum",
	"@Total",
]

export class NumeralsSuggestor extends EditorSuggest<string> {
	plugin: NumeralsPlugin;
	
	/**
	 * Time of last suggestion list update
	 * @type {number}
	 * @private */
	private lastSuggestionListUpdate = 0;

	/**
	 * List of possible suggestions based on current code block
	 * @type {string[]}
	 * @private */
	private localSuggestionCache: string[] = [];

	//empty constructor
	constructor(plugin: NumeralsPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
		const currentFileToCursor = editor.getRange({line: 0, ch: 0}, cursor);
		const indexOfLastCodeBlockStart = currentFileToCursor.lastIndexOf('```');
		// check if the next 4 characters after the last ``` are math or MATH
		const isMathBlock = currentFileToCursor.slice(indexOfLastCodeBlockStart + 3, indexOfLastCodeBlockStart + 7).toLowerCase() === 'math';

		if (!isMathBlock) {
			return null;
		}

		// Get last word in current line
		const currentLineToCursor = editor.getLine(cursor.line).slice(0, cursor.ch);
		const currentLineLastWordStart = currentLineToCursor.search(/[:]?[$@\w\u0370-\u03FF]+$/);
		// if there is no word, return null
		if (currentLineLastWordStart === -1) {
			return null;
		}

		return {
			start: {line: cursor.line, ch: currentLineLastWordStart},
			end: cursor,
			query: currentLineToCursor.slice(currentLineLastWordStart)
		};
	}

	getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
		let localSymbols: string [] = [];	

		// check if the last suggestion list update was less than 200ms ago
		if (performance.now() - this.lastSuggestionListUpdate > 200) {
			const currentFileToStart = context.editor.getRange({line: 0, ch: 0}, context.start);
			const indexOfLastCodeBlockStart = currentFileToStart.lastIndexOf('```');
	
			if (indexOfLastCodeBlockStart > -1) {
				//technically there is a risk we aren't in a math block, but we shouldn't have been triggered if we weren't
				const lastCodeBlockStart = currentFileToStart.lastIndexOf('```');
				const lastCodeBlockStartToCursor = currentFileToStart.slice(lastCodeBlockStart);
	
				// Return all variable names in the last codeblock up to the cursor
				const matches = lastCodeBlockStartToCursor.matchAll(/^\s*(\S*?)\s*=.*$/gm);
				// create array from first capture group of matches and remove duplicates
				localSymbols = [...new Set(Array.from(matches, (match) => 'v|' + match[1]))];
			}

			this.localSuggestionCache = localSymbols;
			this.lastSuggestionListUpdate = performance.now();
		} else {
			localSymbols = this.localSuggestionCache
		}

		const query_lower = context.query.toLowerCase();

		// case-insensitive filter local suggestions based on query. Don't return value if full match
		const local_suggestions = localSymbols.filter((value) => value.slice(0, -1).toLowerCase().startsWith(query_lower, 2));
		local_suggestions.sort((a, b) => a.slice(2).localeCompare(b.slice(2)));
		
		// case-insensitive filter mathjs suggestions based on query. Don't return value if full match
		let suggestions: string[] = [];
		
		const mathjs_suggestions = getMathJsSymbols().filter((value: string) => value.slice(0, -1).toLowerCase().startsWith(query_lower, 2));
		suggestions = local_suggestions.concat(mathjs_suggestions);
		

		suggestions = suggestions.concat(
			numeralsDirectives
				.filter((value) => value.slice(0,-1).toLowerCase().startsWith(query_lower, 0))
				.map((value) => 'm|' + value)
			);

		return suggestions;
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		
		el.addClasses(['mod-complex', 'numerals-suggestion']);
		const suggestionContent = el.createDiv({cls: 'suggestion-content'});
		const suggestionTitle = suggestionContent.createDiv({cls: 'suggestion-title'});
		const suggestionNote = suggestionContent.createDiv({cls: 'suggestion-note'});
		const suggestionAux = el.createDiv({cls: 'suggestion-aux'});
		const suggestionFlair = suggestionAux.createDiv({cls: 'suggestion-flair'});

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const [iconType, suggestionText, noteText] = value.split('|');

		if (iconType === 'f') {
			setIcon(suggestionFlair, 'function-square');		
		} else if (iconType === 'c') {
			setIcon(suggestionFlair, 'locate-fixed');
		} else if (iconType === 'v') {
			setIcon(suggestionFlair, 'file-code');
		} else if (iconType === 'p') {
			setIcon(suggestionFlair, 'box');
		} else if (iconType === 'm') {
			setIcon(suggestionFlair, 'sparkles');			
		} else if (iconType === 'g') {
			setIcon(suggestionFlair, 'case-lower'); // Assuming 'symbol' is a valid icon name
		}
		suggestionTitle.setText(suggestionText);
		if (noteText) {
			suggestionNote.setText(noteText);
		}

	}

	/**
	 * Called when a suggestion is selected. Replaces the current word with the selected suggestion
	 * @param value The selected suggestion
	 * @param evt The event that triggered the selection
	 * @returns void
	 */
	selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
		if (this.context) {
			const editor = this.context.editor;
			const [suggestionType, suggestion] = value.split('|');
			const start = this.context.start;
			const end = editor.getCursor(); // get new end position in case cursor has moved
			
			editor.replaceRange(suggestion, start, end);
			const newCursor = end;

			if (suggestionType === 'f') {
				newCursor.ch = start.ch + suggestion.length-1;
			} else {
				newCursor.ch = start.ch + suggestion.length;
			}
			editor.setCursor(newCursor);			

			this.close()
		}
	}
}