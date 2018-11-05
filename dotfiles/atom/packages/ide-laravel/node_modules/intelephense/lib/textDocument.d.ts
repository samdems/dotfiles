import { Position } from 'vscode-languageserver-types';
export declare class TextDocument {
    private _uri;
    private _text;
    private _lineOffsets;
    constructor(uri: string, text: string);
    readonly uri: string;
    text: string;
    readonly lineOffsets: number[];
    textBeforeOffset(offset: number, length: number): string;
    lineText(line: number): string;
    lineAtOffset(offset: number): number;
    lineSubstring(offset: number): string;
    offsetAtLine(line: number): number;
    textAtOffset(offset: number, length: number): string;
    positionAtOffset(offset: number): Position;
    offsetAtPosition(pos: Position): number;
    applyEdit(start: Position, end: Position, text: string): void;
    private _textLineOffsets(text, offset);
}
