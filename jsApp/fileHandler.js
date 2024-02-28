import * as fs from 'fs';

export class FileHandler {
    constructor() { }

    readFileToText(filename) {
        const textFromFile = fs.readFileSync(filename, 'utf8');
        return textFromFile;
    }

    replaceVar(text, varObj) {
        let result = text;
        for (const [key, value] of Object.entries(varObj)) {
            result = result.replace(`{${key}}`, value);
        }
        return result;
    }
}
