import * as readline from 'readline';
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

    console.log('Initializing WhatsApp client...');
    await wsaHdl.initialize();

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
