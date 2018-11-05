import { NameResolver } from './nameResolver';
export declare namespace TypeString {
    function atomicClassArray(typeString: string): string[];
    function arrayDereference(typeString: string): string;
    function arrayReference(typeString: string): string;
    function merge(a: string, b: string): string;
    function mergeMany(typeStrings: string[]): string;
    function nameResolve(typeString: string, nameResolver: NameResolver): string;
    function count(typeString: string): number;
    function resolveThisOrStatic(typeString: string, fqn: string): string;
}
