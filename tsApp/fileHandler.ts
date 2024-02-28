import * as fs from 'fs';

export class FileHandler {
    public constructor() {}

    public readFileToText(filename: string): string {
        const textFromFile = fs.readFileSync(filename, 'utf8');
        return textFromFile;
    }

    public replaceVar(filename: string, varName: string, varValue: string): string {
        let data = this.readFileToText(filename);
        let result = data.replace(/{varName}/g, varValue);
        return result;
    }
}
