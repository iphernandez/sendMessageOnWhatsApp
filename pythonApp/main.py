from datetime import date
import sys
import fileHandler as rm
import dateHandler as dt


def render_markdown_for_console(markdown):
	lines = markdown.splitlines()
	rendered = []
	in_code_block = False

	for line in lines:
		trimmed = line.strip()

		if trimmed.startswith("```"):
			in_code_block = not in_code_block
			if not in_code_block:
				rendered.append("")
			continue

		if in_code_block:
			rendered.append(line)
			continue

		if trimmed.startswith("#"):
			rendered.append(trimmed.lstrip("# "))
			rendered.append("")
			continue

		cleaned_line = ""
		in_inline_code = False
		for character in line:
			if character == "`":
				in_inline_code = not in_inline_code
				continue
			cleaned_line += character

		rendered.append(cleaned_line)

	return "\n".join(rendered).strip()


def load_cli_help():
	with open("./CLI_HELP.md", "r", encoding="utf-8") as help_file:
		return render_markdown_for_console(help_file.read())


def parse_cli_args(argv):
	return {
		"help": "--help" in argv or "-h" in argv,
	}


def main(argv):
	args = parse_cli_args(argv)

	if args["help"]:
		print(load_cli_help())
		return

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
	template_values = {
		"weekDateIndex": weekDateIndex,
		"initialSeasonDate": initialSeasonDate,
		"groupName": groupName,
		"horaDeJuego": horaDeJuego,
		"hour": hour,
		"minute": minute,
		"inicioTemporadaAA": inicioTemporadaAA,
		"diaDeJuego": diaDeJuego,
		"semanaTemporada": semanaTemporada,
		"finTemporadaAA": finTemporadaAA,
	}
	modMessage = message.format(**template_values)
	print(modMessage)

	import whatsappHandler as wa

	wa.sendMessage(groupName,modMessage)


main(sys.argv)