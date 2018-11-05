import { PhpSymbol, SymbolKind } from './symbol';
export declare class NameResolver {
    private _classStack;
    rules: PhpSymbol[];
    namespace: PhpSymbol;
    constructor();
    readonly class: PhpSymbol;
    readonly namespaceName: string;
    readonly className: string;
    readonly classBaseName: string;
    pushClass(symbol: PhpSymbol): void;
    popClass(): void;
    resolveRelative(relativeName: string): string;
    resolveNotFullyQualified(notFqn: string, kind?: SymbolKind, resolveStatic?: boolean): string;
    concatNamespaceName(prefix: string, suffix: string): string;
    matchImportedSymbol(text: string, kind: SymbolKind): PhpSymbol;
    private _resolveQualified(name, pos);
    private _resolveUnqualified(name, kind);
}
