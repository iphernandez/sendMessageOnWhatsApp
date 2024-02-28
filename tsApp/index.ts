import { WhatsAppHandler } from './whatsappHandler';
import { DateHandler } from './dateHandler';
import { FileHandler } from './fileHandler';

function main() {
    let wsaHdl = new WhatsAppHandler();
    let dtHdl = new DateHandler();
    let flHdl = new FileHandler();

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

main();
