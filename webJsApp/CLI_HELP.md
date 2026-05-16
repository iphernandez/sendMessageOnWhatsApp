# WhatsApp Group Chat - Web.js App

## Usage

```bash
node index.js [options]
```

## Options

- `--help`, `-h`
  Show this help message and exit.
- `--auto`
  Run an automated flow instead of opening the interactive menu.
- `--test`
  Use the `TEST` entry from `config.json`. If omitted, the `FFCH` entry is used.
- `--type <convocatoria|convocados|poll-votes>`
  Select which automated flow to run. Default: `convocatoria`.
- `--season <name>`
  Select the season used by the `convocatoria` automated flow. If omitted, the value in `config.json -> <profile> -> convocatoria.default` is used.
- `--poll-question <text>`
  Override the poll question used by the `poll-votes` automated flow. If omitted, the poll question is rendered from `config.json -> <profile> -> convocatoria.poll.question`.

## Examples

```bash
node index.js
node index.js --help
node index.js --auto --type convocados
node index.js --auto --type convocados --test
node index.js --auto --type convocatoria --season Invierno
node index.js --auto --type convocatoria --season Verano
node index.js --auto --type poll-votes
node index.js --auto --type poll-votes --poll-question "Quienes juegan hoy?"
```

## Notes

- Interactive mode starts the menu for sending messages, pictures, and poll actions manually.
- Automated `convocatoria` reads message and poll settings from the selected `config.json` profile, renders the template, optionally sends `reglamento.md`, creates the poll, votes on it, and increments the selected season `WEEK_NUMBER`.
- Automated `convocados` sends the configured message file to the configured WhatsApp group from the selected `config.json` profile.
- Automated `poll-votes` resolves the next play date, uses `--poll-question` when provided (otherwise the configured poll name from the selected `config.json` profile), fetches the voters for the configured yes-answer option, and prints the voter list.