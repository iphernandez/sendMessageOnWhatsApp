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
- `--type <convocatoria|convocados|poll-votes>`
  Select which automated flow to run. Default: `convocatoria`.
- `--season <name>`
  Select the season used by the `convocatoria` automated flow. If omitted, the value in `config.json -> convocatoria.default` is used.

## Examples

```bash
node index.js
node index.js --help
node index.js --auto --type convocados
node index.js --auto --type convocatoria --season Invierno
node index.js --auto --type convocatoria --season Verano
node index.js --auto --type poll-votes
```

## Notes

- Interactive mode starts the menu for sending messages, pictures, and poll actions manually.
- Automated `convocatoria` reads message and poll settings from `config.json`, renders the template, optionally sends `reglamento.md`, creates the poll, votes on it, and increments the selected season `WEEK_NUMBER`.
- Automated `convocados` sends the configured message file to the configured WhatsApp group.
- Automated `poll-votes` resolves the next play date, renders the configured poll name from `config.json`, fetches the voters for the configured yes-answer option, and prints the voter list.