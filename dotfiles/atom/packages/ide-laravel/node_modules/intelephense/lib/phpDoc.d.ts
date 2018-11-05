export declare namespace PhpDocParser {
    function parse(input: string): PhpDoc;
}
export interface MethodTagParam {
    typeString: string;
    name: string;
}
export interface Tag {
    tagName: string;
    name: string;
    description: string;
    typeString: string;
    parameters?: MethodTagParam[];
    isStatic?: boolean;
}
export declare class PhpDoc {
    text: string;
    tags: Tag[];
    constructor(text: string, tags: Tag[]);
    readonly returnTag: Tag;
    readonly propertyTags: Tag[];
    readonly methodTags: Tag[];
    readonly varTags: Tag[];
    findParamTag(name: string): Tag;
    findVarTag(name: string): Tag;
}
export declare namespace PhpDoc {
    function isPropertyTag(t: Tag): boolean;
    function isReturnTag(t: Tag): boolean;
    function isMethodTag(t: Tag): boolean;
    function isVarTag(t: Tag): boolean;
}
