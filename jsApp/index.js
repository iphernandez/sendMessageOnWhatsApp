import { WhatsAppHandler } from './whatsappHandler.js';
import { FileHandler } from './fileHandler.js';
import { DateHandler } from './dateHandler.js';

function main() {
    let wsaHdl = new WhatsAppHandler();
    let dtHdl = new DateHandler();
    let flHdl = new FileHandler();

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
