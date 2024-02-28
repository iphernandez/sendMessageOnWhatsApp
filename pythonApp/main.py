from datetime import date
import fileHandler as rm
import dateHandler as dt
import whatsappHandler as wa

# Constants
weekDateIndex=3
initialSeasonDate=date(2023,12,14)
groupName = "Test de Applicacion" #"FFCH -- La M de tu mama"
horaDeJuego="8:00pm"

# Specify the time in 24-hour format (hour, minute)
# Example: send the message immediately
hour = None
minute = None
inicioTemporadaAA=initialSeasonDate.year
diaDeJuego=dt.getExpectedDate(date.today(), weekDateIndex)
semanaTemporada=dt.weekDifference(initialSeasonDate,diaDeJuego)
finTemporadaAA=diaDeJuego.year

message = rm.readFileToText("../message.txt")
modMessage = message.format(**globals())
print(modMessage)

wa.sendMessage(groupName,modMessage)