import { FileHandler } from './fileHandler.js';
import { DateHandler } from './dateHandler.js';

function renderMarkdownForConsole(markdown) {
    const lines = markdown.split(/\r?\n/);
    const rendered = [];
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

function loadCliHelp(flHdl) {
    return renderMarkdownForConsole(flHdl.readFileToText('./CLI_HELP.md'));
}

function parseCliArgs(argv) {
    return {
        help: argv.includes('--help') || argv.includes('-h'),
    };
}

async function main() {
    let flHdl = new FileHandler();
    const args = parseCliArgs(process.argv);

    if (args.help) {
        console.log(loadCliHelp(flHdl));
        return;
    }

    const { WhatsAppHandler } = await import('./whatsappHandler.js');
    let wsaHdl = new WhatsAppHandler();
    let dtHdl = new DateHandler();

    const weekDateIndex = 4;
    const initialSeasonDate = new Date(2023, 11, 14);
    const groupName = 'Test de Applicacion'; //"FFCH -- La M de tu mama"
    const horaDeJuego = '8:00pm';
    const today = new Date(new Date().setHours(0, 0, 0, 0));

    let inicioTemporadaAA = initialSeasonDate.getFullYear();
    let diaDeJuego = dtHdl.getExpectedDate(today, weekDateIndex);
    let semanaTemporada = dtHdl.weekDifference(initialSeasonDate, diaDeJuego, weekDateIndex);
    let finTemporadaAA = diaDeJuego.getFullYear();

    let varObject = {
        groupName: groupName,
        diaDeJuego: diaDeJuego.toDateString(),
        horaDeJuego: horaDeJuego,
        inicioTemporadaAA: inicioTemporadaAA.toString(),
        finTemporadaAA: finTemporadaAA.toString(),
        semanaTemporada: semanaTemporada.toString(),
    }

    let message = flHdl.readFileToText('../message.txt');
    let modMessage = flHdl.replaceVar(message, varObject);
    console.log(`MESSAGE TO SEND: ${modMessage}`);

    // Call the function to send the message
    wsaHdl.sendWhatsappMessage(groupName, modMessage);
}

main();
