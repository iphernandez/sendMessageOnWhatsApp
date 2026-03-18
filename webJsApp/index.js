import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { WhatsAppHandler } from './whatsappHandler.js';
import { FileHandler } from './fileHandler.js';
import { DateHandler } from './dateHandler.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function prompt(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

function getNextThursday(baseDate = new Date()) {
    const date = new Date(baseDate);
    date.setHours(0, 0, 0, 0);

    const thursdayIndex = 4;
    const currentDay = date.getDay();
    const daysUntilThursday = (thursdayIndex - currentDay + 7) % 7;

    date.setDate(date.getDate() + daysUntilThursday);
    return date;
}

function formatDateForMessage(date) {
    return date.toLocaleDateString('es-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function renderTemplate(template, variables) {
    return template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, key) => {
        if (Object.prototype.hasOwnProperty.call(variables, key)) {
            return String(variables[key]);
        }
        return match;
    });
}

function parseOptions(optionsRaw) {
    if (Array.isArray(optionsRaw)) {
        return optionsRaw.map((opt) => String(opt).trim()).filter(Boolean);
    }

    return String(optionsRaw || '')
        .split(',')
        .map((opt) => opt.trim())
        .filter(Boolean);
}

function parseBooleanFlag(value) {
    return String(value || '').trim().toLowerCase() === 'y';
}

function resolveSeason(config, requestedSeason) {
    const seasons = Array.isArray(config.seasons) ? config.seasons : [];

    if (seasons.length === 0) {
        throw new Error('No seasons were found in config.json under "seasons".');
    }

    if (!requestedSeason) {
        return seasons[0];
    }

    const season = seasons.find(
        (item) => String(item.season).toLowerCase() === String(requestedSeason).toLowerCase()
    );

    if (!season) {
        throw new Error(
            `Season "${requestedSeason}" not found. Available seasons: ${seasons
                .map((item) => item.season)
                .join(', ')}`
        );
    }

    return season;
}

function resolveSeasonIndex(config, requestedSeason) {
    const seasons = Array.isArray(config.seasons) ? config.seasons : [];

    if (seasons.length === 0) {
        throw new Error('No seasons were found in config.json under "seasons".');
    }

    if (!requestedSeason) {
        return 0;
    }

    const seasonIndex = seasons.findIndex(
        (item) => String(item.season).toLowerCase() === String(requestedSeason).toLowerCase()
    );

    if (seasonIndex < 0) {
        throw new Error(
            `Season "${requestedSeason}" not found. Available seasons: ${seasons
                .map((item) => item.season)
                .join(', ')}`
        );
    }

    return seasonIndex;
}

async function runAutomatedConvocatoriaFlow(wsaHdl, options = {}) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const workspaceRoot = path.resolve(__dirname, '..');

    const configPath = path.join(workspaceRoot, 'config.json');
    const convocatoriaPath = path.join(workspaceRoot, 'convocatoria.md');

    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
    }

    if (!fs.existsSync(convocatoriaPath)) {
        throw new Error(`Template file not found: ${convocatoriaPath}`);
    }

    const rawConfig = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(rawConfig);
    const seasonIndex = resolveSeasonIndex(config, options.seasonName);
    const season = resolveSeason(config, options.seasonName);

    const playDate = getNextThursday(new Date());
    const renderedDate = formatDateForMessage(playDate);

    const variables = {
        DATE: renderedDate,
        TIME: season.TIME,
        LOCATION: season.LOCATION,
        LOCATION_URL: season.LOCATION_URL,
        SEASON: season.season,
        WEEK_NUMBER: season.WEEK_NUMBER,
        YELLOW_CARDS_LATE: season.YELLOW_CARDS_LATE,
        RED_CARDS_LATE: season.RED_CARDS_LATE,
        RED_CARDS_PAYMENT: season.RED_CARDS_PAYMENT,
    };

    const convocatoriaTemplate = fs.readFileSync(convocatoriaPath, 'utf8');
    const message = renderTemplate(convocatoriaTemplate, variables);

    const groupName = config.group;
    if (!groupName) {
        throw new Error('"group" was not found in config.json.');
    }

    const pollConfig = config.poll || {};
    const pollQuestion = renderTemplate(String(pollConfig.question || ''), variables);
    const pollOptions = parseOptions(pollConfig.options);
    const allowMultipleAnswers = parseBooleanFlag(pollConfig.multiple_options);
    const pollAnswer = parseOptions(pollConfig.answer);

    if (!pollQuestion) {
        throw new Error('"poll.question" is required in config.json.');
    }

    if (pollOptions.length < 2) {
        throw new Error('"poll.options" must include at least 2 options.');
    }

    if (pollAnswer.length === 0) {
        throw new Error('"poll.answer" must include at least one option value.');
    }

    console.log('\nMessage to send:\n');
    console.log(message);
    console.log('\nPoll to create:');
    console.log(`Question: ${pollQuestion}`);
    console.log(`Options: ${pollOptions.join(', ')}`);
    console.log(`Allow multiple answers: ${allowMultipleAnswers ? 'yes' : 'no'}`);
    console.log(`Vote answer(s): ${pollAnswer.join(', ')}\n`);

    await wsaHdl.sendMessage(groupName, message);
    await wsaHdl.createPoll(groupName, pollQuestion, pollOptions, {
        allowMultipleAnswers,
    });
    await wsaHdl.voteOnPoll(groupName, pollQuestion, pollAnswer);

    const currentWeekNumber = Number(config.seasons[seasonIndex].WEEK_NUMBER);
    if (!Number.isFinite(currentWeekNumber)) {
        throw new Error(
            `WEEK_NUMBER for season "${season.season}" is not a valid number.`
        );
    }

    config.seasons[seasonIndex].WEEK_NUMBER = currentWeekNumber + 1;
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 4)}\n`, 'utf8');
    console.log(
        `Updated config.json: season "${season.season}" WEEK_NUMBER is now ${config.seasons[seasonIndex].WEEK_NUMBER}.`
    );

    console.log('Automated convocatoria flow completed successfully.');
}

function parseCliArgs(argv) {
    const args = {
        auto: false,
        seasonName: null,
    };

    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];

        if (arg === '--auto') {
            args.auto = true;
        } else if (arg === '--season' && i + 1 < argv.length) {
            args.seasonName = argv[i + 1];
            i += 1;
        }
    }

    return args;
}

async function sendMessageFlow(wsaHdl) {
    const groupName = await prompt('Enter group name: ');
    const useTemplate = await prompt('Use message template file? (y/n): ');

    let message;
    if (useTemplate.toLowerCase() === 'y') {
        const flHdl = new FileHandler();
        const dtHdl = new DateHandler();

        const weekDateIndex = 4;
        const initialSeasonDate = new Date(2023, 11, 14);
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
        };

        let rawMessage = flHdl.readFileToText('../message.txt');
        message = flHdl.replaceVar(rawMessage, varObject);
    } else {
        message = await prompt('Enter message: ');
    }

    console.log(`\nMessage to send:\n${message}\n`);
    await wsaHdl.sendMessage(groupName, message);
}

async function sendPictureFlow(wsaHdl) {
    const groupName = await prompt('Enter group name: ');
    const filePath = await prompt('Enter image file path: ');
    const caption = await prompt('Enter caption (or press Enter to skip): ');

    const flHdl = new FileHandler();
    const resolvedPath = flHdl.resolvePath(filePath);

    if (!flHdl.fileExists(resolvedPath)) {
        console.error(`File not found: ${resolvedPath}`);
        return;
    }

    await wsaHdl.sendPicture(groupName, resolvedPath, caption);
}

async function createPollFlow(wsaHdl) {
    const groupName = await prompt('Enter group name: ');
    const pollName = await prompt('Enter poll question: ');
    const optionsRaw = await prompt('Enter poll options (comma-separated): ');
    const allowMultiple = await prompt('Allow multiple answers? (y/n): ');

    const pollOptions = optionsRaw.split(',').map((opt) => opt.trim()).filter(Boolean);

    if (pollOptions.length < 2) {
        console.error('A poll needs at least 2 options.');
        return;
    }

    await wsaHdl.createPoll(groupName, pollName, pollOptions, {
        allowMultipleAnswers: allowMultiple.toLowerCase() === 'y',
    });
}

async function voteOnPollFlow(wsaHdl) {
    const groupName = await prompt('Enter group name: ');
    const pollName = await prompt('Enter poll question to vote on: ');
    const selectedRaw = await prompt('Enter your vote(s) (comma-separated option text): ');

    const selectedOptions = selectedRaw.split(',').map((opt) => opt.trim()).filter(Boolean);

    if (selectedOptions.length === 0) {
        console.error('You must select at least one option.');
        return;
    }

    await wsaHdl.voteOnPoll(groupName, pollName, selectedOptions);
}

function showMenu() {
    console.log('\n========================================');
    console.log('  WhatsApp Group Chat - Web.js App');
    console.log('========================================');
    console.log('  1. Send a message');
    console.log('  2. Send a picture');
    console.log('  3. Create a poll');
    console.log('  4. Vote on a poll');
    console.log('  5. Exit');
    console.log('========================================\n');
}

async function main() {
    const wsaHdl = new WhatsAppHandler();
    const args = parseCliArgs(process.argv);

    console.log('Initializing WhatsApp client...');
    await wsaHdl.initialize();

    if (args.auto) {
        try {
            await runAutomatedConvocatoriaFlow(wsaHdl, {
                seasonName: args.seasonName,
            });
        } finally {
            await wsaHdl.destroy();
            rl.close();
        }

        return;
    }

    let running = true;
    while (running) {
        showMenu();
        const choice = await prompt('Select an option (1-5): ');

        try {
            switch (choice.trim()) {
                case '1':
                    await sendMessageFlow(wsaHdl);
                    break;
                case '2':
                    await sendPictureFlow(wsaHdl);
                    break;
                case '3':
                    await createPollFlow(wsaHdl);
                    break;
                case '4':
                    await voteOnPollFlow(wsaHdl);
                    break;
                case '5':
                    running = false;
                    break;
                default:
                    console.log('Invalid option. Please select 1-5.');
            }
        } catch (error) {
            console.error(`Error: ${error.message}`);
        }
    }

    await wsaHdl.destroy();
    rl.close();
    console.log('Goodbye!');
}

main();
