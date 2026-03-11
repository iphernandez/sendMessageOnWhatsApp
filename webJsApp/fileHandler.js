import * as fs from 'fs';
import * as path from 'path';

export class FileHandler {
    constructor() {}

    /**
     * Read a file and return its contents as a string.
     * @param {string} filename - The path to the file to read.
     * @returns {string} The file contents.
     */
    readFileToText(filename) {
        const textFromFile = fs.readFileSync(filename, 'utf8');
        return textFromFile;
    }

    /**
     * Replace template variables in a text string using a variable object.
     * Variables in the text should be in the form {variableName}.
     * @param {string} text - The template text.
     * @param {object} varObj - Key-value pairs for substitution.
     * @returns {string} The text with variables replaced.
     */
    replaceVar(text, varObj) {
        let result = text;
        for (const [key, value] of Object.entries(varObj)) {
            result = result.replaceAll(`{${key}}`, value);
        }
        return result;
    }

    /**
     * Resolve a file path relative to the project root.
     * @param {string} filePath - The relative file path.
     * @returns {string} The resolved absolute path.
     */
    resolvePath(filePath) {
        return path.resolve(filePath);
    }

    /**
     * Check if a file exists.
     * @param {string} filePath - The path to check.
     * @returns {boolean} True if the file exists.
     */
    fileExists(filePath) {
        return fs.existsSync(filePath);
    }
}
