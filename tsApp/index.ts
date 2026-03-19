import { DateHandler } from './dateHandler';
import { FileHandler } from './fileHandler';

function renderMarkdownForConsole(markdown: string): string {
    const lines = markdown.split(/\r?\n/);
    const rendered: string[] = [];
    let inCodeBlock = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            if (!inCodeBlock) {
                rendered.push('');
            }
            continue;
        }

        if (inCodeBlock) {
            rendered.push(line);
            continue;
        }

        if (trimmed.startsWith('#')) {
            rendered.push(trimmed.replace(/^#+\s*/, ''));
            rendered.push('');
            continue;
        }

        rendered.push(line.replace(/`([^`]+)`/g, '$1'));
    }

    return rendered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function loadCliHelp(flHdl: FileHandler): string {
    return renderMarkdownForConsole(flHdl.readFileToText('./CLI_HELP.md'));
}

function parseCliArgs(argv: string[]): { help: boolean } {
    return {
        help: argv.includes('--help') || argv.includes('-h'),
    };
}

async function main(argv: string[]): Promise<void> {
    let flHdl = new FileHandler();
    const args = parseCliArgs(argv);

    if (args.help) {
        console.log(loadCliHelp(flHdl));
        return;
    }

    const { WhatsAppHandler } = await import('./whatsappHandler');
    let wsaHdl = new WhatsAppHandler();
    let dtHdl = new DateHandler();

    const weekDateIndex = 4;
    const initialSeasonDate = new Date(2023, 11, 14);
    const groupName = 'Test de Applicacion'; //"FFCH -- La M de tu mama"
    const horaDeJuego = '8:00pm';

    let inicioTemporadaAA = initialSeasonDate.getFullYear();
    let diaDeJuego = dtHdl.getExpectedDate(new Date(), weekDateIndex);
    let semanaTemporada = dtHdl.weekDifference(initialSeasonDate, diaDeJuego);
    let finTemporadaAA = diaDeJuego.getFullYear();

    let message = flHdl.readFileToText('../message.txt');
    let modMessage = flHdl.replaceVar(message, "groupName", groupName);
    modMessage = flHdl.replaceVar(message, 'diaDeJuego', diaDeJuego.toDateString());
    modMessage = flHdl.replaceVar(message, 'horaDeJuego', horaDeJuego);
    modMessage = flHdl.replaceVar(message, 'inicioTemporadaAA', inicioTemporadaAA.toString());
    modMessage = flHdl.replaceVar(message, 'finTemporadaAA', finTemporadaAA.toString());
    modMessage = flHdl.replaceVar(message, 'semanaTemporada', semanaTemporada.toString());

    console.log(modMessage);

    // Call the function to send the message
    //wsaHdl.sendWhatsappMessage(groupName, message);
}

main((globalThis as { process?: { argv?: string[] } }).process?.argv ?? []);
