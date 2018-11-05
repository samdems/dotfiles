# php7parser

A fast and forgiving PHP7 recursive descent parser implemented in Typescript. 

The parser outputs a parse tree of phrases (branches) and tokens (leaves). The complete source code is represented by the tree including whitespace.

## Design Goals

* Modern browser and nodejs compatibility.
* Error tolerant and high performance.
* Output representative of full source code.
* Adherance to the PHP language specifications.
* Prefer error tolerance over enforcement of language constraints.

## Usage

```typescript
    import { Parser } from 'php7parser';

    let src = '<?php echo "Hello World!";';
    let tree = Parser.parse(src);
```

## Interface

```typescript

    export declare namespace Parser {
        function parse(text: string): Phrase;
    }

    export interface Phrase {
        /**
         * Phrase type
         */
        phraseType: PhraseType;
        /**
         * Phrase and token child nodes
         */
        children: (Phrase | Token)[];
    }

    export interface ParseError extends Phrase {

        /**
         * The token that prompted the parse error
         */
        unexpected: Token;

        /**
         * The expected token type
         */
        expected?: TokenType;

    }

    export interface Token {
        /**
         * Token type
         */
        tokenType: TokenType;
        /**
         * Offset within source where first char of token is found
         */
        offset: number;
        /**
         * Length of token string
         */
        length: number;
        /**
         * Lexer mode prior to this token being read.
         */
        modeStack: LexerMode[];
    }

```
