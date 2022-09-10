/**
 * Trying to write a JSON parser.
 */

const GLOBALS = {
    JSON_COMMA: ",",
    JSON_COLON: ":",
    JSON_LEFTBRACKET: "[",
    JSON_RIGHTBRACKET: "]",
    JSON_LEFTBRACE: "{",
    JSON_RIGHTBRACE: "}",
    JSON_QUOTE: '"',
    JSON_WHITESPACE: [" ", "\t", "\b", "\n", "\r"],
};
const JSON_SYNTAX = [
    GLOBALS.JSON_COMMA,
    GLOBALS.JSON_COLON,
    GLOBALS.JSON_LEFTBRACE,
    GLOBALS.JSON_RIGHTBRACE,
    GLOBALS.JSON_LEFTBRACKET,
    GLOBALS.JSON_RIGHTBRACKET,
];

let input = `
{
    "name": "vivek",
    "languages": [
        "js",
        "ts",
        "rust"
    ]
}
`;
type TBasic = string | boolean | null | number;
type TObject = { [key: string]: any };
type TArray = (
    | string
    | boolean
    | null
    | number
    | TObject
    | Array<string | boolean | null | number | TObject>
)[];
type TLex = Array<string | number | boolean | null>;

class JsonLexer {
    private _input: string;

    constructor(input: string) {
        this._input = input;
    }

    lexString(input: string): [null | string, string] {
        // To store the parsed string if any.
        let json_string: string = "";

        if (input[0] === GLOBALS.JSON_QUOTE) {
            // When input starts with `"`
            input = input.slice(1);
        } else {
            // It aint string
            return [null, input];
        }

        // Parse the string;
        for (let c of input) {
            if (c === GLOBALS.JSON_QUOTE) {
                // Return the rest of the input with parsed string
                // +1 denotes to skip trailing `"`
                return [json_string, input.slice(json_string.length + 1)];
            } else {
                // it should be string;
                json_string += c;
            }
        }

        throw "Expected end-of-string quote.";
    }

    lexNumber(input: string): [null | number, string] {
        let json_number: string = "";
        const numbers = [
            "0",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "e",
            "-",
            ".",
        ];

        for (let c of input) {
            if (numbers.includes(c)) {
                json_number += c;
            } else {
                break;
            }
        }

        let rest = input.slice(json_number.length);

        // If the number is nothing.
        if (!json_number.length) {
            return [null, rest];
        }

        // If there is `.` in it then it's a float.
        if (json_number.includes(".")) {
            return [parseFloat(json_number), rest];
        }

        return [parseInt(json_number), rest];
    }

    lexBool(input: string): [null | boolean, string] {
        let inputLen = input.length;
        const trueLength = "true".length;
        const falseLength = "false".length;

        if (inputLen >= trueLength && input.slice(0, trueLength) === "true") {
            return [true, input.slice(trueLength)];
        } else if (
            inputLen >= falseLength &&
            input.slice(0, falseLength) === "false"
        ) {
            return [false, input.slice(falseLength)];
        }

        return [null, input];
    }

    lexNull(input: string): [null | true, string] {
        let inputLen = input.length;
        let nullLen = "null".length;

        if (inputLen >= nullLen && input.slice(0, nullLen) === "null") {
            return [true, input.slice(nullLen)];
        }

        return [null, input];
    }

    lex(): TLex {
        let tokens: TLex = [];

        while (this._input) {
            let data;

            // Try to parse string
            data = this.lexString(this._input);
            if (data[0] !== null) {
                // Add parsed string to tokens and continue.
                tokens.push(data[0]);
                this._input = data[1];
                continue;
            }

            // parse number
            data = this.lexNumber(this._input);
            if (data[0] !== null) {
                tokens.push(data[0]);
                this._input = data[1];
                continue;
            }

            // Trying to parse boolean
            data = this.lexBool(this._input);
            if (data[0] !== null) {
                tokens.push(data[0]);
                this._input = data[1];
                continue;
            }

            // Trying to parse null
            data = this.lexNull(this._input);
            if (data[0] !== null) {
                tokens.push(null);
                this._input = data[1];
                continue;
            }

            // Parse any character which is in json syntax or
            // skip if it's a whitespace.
            if (GLOBALS.JSON_WHITESPACE.includes(this._input[0])) {
                this._input = this._input.slice(1);
            } else if (JSON_SYNTAX.includes(this._input[0])) {
                tokens.push(this._input[0]);
                this._input = this._input.slice(1);
            } else {
                throw `nvalid character: ${this._input[0]}`;
            }
        }
        return tokens;
    }
}

class JsonParser {
    parseArray(tokens: TLex): [TObject, TLex] {
        // NOTE: tokens here doesn't start with `[` it can if it's from the element of
        // array but not from the array itself.
        let json_array: Array<number | object | string | boolean | null> = [];
        let t = tokens[0];

        // CASE: When the array is empty.
        // Because in that case the first element would be `]`
        if (t === GLOBALS.JSON_RIGHTBRACKET) {
            return [json_array, tokens.slice(1)];
        }

        while (true) {
            // Lets recursively parse each element of array.

            // Parse element.
            let data = this.parse(tokens);
            json_array.push(data[0]);
            tokens = data[1];

            let t = tokens[0];
            if (t === GLOBALS.JSON_RIGHTBRACKET) {
                // Return parsed elements with rest of the tokens.
                // +1 is there to skip the right bracket.
                return [json_array, tokens.slice(1)];
            }

            // Now we should get a comma because other wise it's
            // not a valid json array.
            else if (t !== GLOBALS.JSON_COMMA) {
                throw "Expected comma after object in array.";
            }

            // If comma is there then we'll skip it and continue this process again
            // until we parsed all the elements from the array.
            else {
                tokens = tokens.slice(1);
            }
        }

        // CASE: Why ? FIx it plz.
        throw "Expected end of array bracket.";
    }

    parseObject(tokens: TLex): [TObject, TLex] {
        let json_object: TObject = {};

        let t = tokens[0];

        // When the object doesn't have any key-value pair.
        // then it'll have the `}` and we'll return empty object + rest of the tokens.
        if (t === GLOBALS.JSON_RIGHTBRACE) {
            return [json_object, tokens.slice(1)];
        }

        while (true) {
            let json_key = tokens[0];

            // Validate if the key is string
            if (typeof json_key === "string") {
                tokens = tokens.slice(1);
            } else {
                throw "Expected string key, got " + json_key;
            }

            // Valide if we got a `:` after the key.
            if (tokens[0] !== GLOBALS.JSON_COLON) {
                throw `Expected colon after the key in object.`;
            }

            // Skip the `:` in the tokens.
            tokens = tokens.slice(1);

            // Parse the value
            // NOTE: If the value is neither an array nor object then it'll
            // just return the next_token, rest_of_token which will mean that
            // your value is either a null, bool, string, number basically basic
            // data type.
            let [json_value, rest_tokens] = this.parse(tokens);
            json_object[json_key] = json_value;
            tokens = rest_tokens;

            t = tokens[0];

            // Check if we got to the end of the object which means that
            // next tokens will be `}`
            if (t === GLOBALS.JSON_RIGHTBRACE) {
                // +1 to skip right brace.
                return [json_object, tokens.slice(1)];
            } else if (t !== GLOBALS.JSON_COMMA) {
                // Else we should get a comma to parse the next key-value pair.
                throw `Expected comma after pair in object but got: ${t}`;
            }

            // Skip the comma
            tokens = tokens.slice(1);
        }

        throw "This should not happen";
    }

    // Bracket is [ and brace is {
    parse(
        tokens: TLex,
        isRoot: boolean = false
    ): [TArray | TObject | TBasic, TLex] {
        // parse the tokens
        let t = tokens[0];

        if (t !== GLOBALS.JSON_LEFTBRACE && isRoot) {
            throw "Root needs to be an object.";
        }

        if (t === GLOBALS.JSON_LEFTBRACKET) {
            // Parse array.
            // +1 to skip the left bracket.
            return this.parseArray(tokens.slice(1));
        } else if (t === GLOBALS.JSON_LEFTBRACE) {
            // Parse object.
            // +1 to skip the left brace.
            return this.parseObject(tokens.slice(1));
        } else {
            return [t, tokens.slice(1)];
        }
    }
}

const stringToJson = (str: string) => {
    const lex = new JsonLexer(str);
    const parser = new JsonParser();
    return parser.parse(lex.lex(), true)[0];
};

const jsonToString = (j: any): string => {
    if (j.constructor.name === "Array") {
        let array_string = "[";
        if (!j.length) {
            return "[]";
        }
        for (let a of j) {
            if (typeof a === "string") {
                array_string += `"${a}",`;
            } else if (typeof a === "number") {
                array_string += `${a},`;
            } else if (typeof a === "boolean") {
                array_string += a == true ? `true,` : `false,`;
            } else if (a === null) {
                array_string += `null,`;
            } else if (typeof a === "object" && a !== null) {
                // Either array or object.
                let str_rep = jsonToString(a);
                array_string += `${str_rep},`;
            }
        }
        array_string = array_string.slice(0, array_string.length - 1);
        array_string += "]";
        return array_string;
    } else if (j.constructor.name === "Object") {
        let object_string = "{";
        for (let key of Object.keys(j)) {
            if (typeof j[key] === "string") {
                object_string += `"${key}": "${j[key]}",`;
            } else if (typeof j[key] === "number") {
                object_string += `"${key}": ${j[key]},`;
            } else if (typeof j[key] === "boolean") {
                object_string += `"${key}": ${
                    j[key] == true ? "true" : "false"
                },`;
            } else if (j[key] === null) {
                object_string += `"${key}": ${j[key]},`;
            } else if (typeof j[key] === "object" && j[key] !== null) {
                // Either array or object.
                let str_rep = jsonToString(j[key]);
                object_string += `"${key}": ${str_rep},`;
            }
        }
        object_string = object_string.slice(0, object_string.length - 1);
        object_string += "}";
        return object_string;
    }
    throw "Not object or array.";
};

// // Test the JsonLexer.
// console.log("Original Input: \n", input);

// const lex = new JsonLexer(input);
// const parser = new JsonParser();

// const tokens = lex.lex();
// console.log("Lexed Input: \n", tokens);

// // Parse the tokens.
// console.log("Parsed Object: \n", parser.parse(tokens));

console.log(stringToJson(input));

console.log("=== Test for Json -> string");
console.log(jsonToString([24, "vivek", false, null]));

console.log(jsonToString({ a: "vivek" }));
console.log(jsonToString(JSON.parse(input)));
