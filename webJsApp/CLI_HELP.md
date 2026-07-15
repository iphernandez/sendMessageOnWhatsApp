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
  Select the season used by the `convocatoria` or `poll-votes` automated flow. If omitted, the flow uses the season resolved from `config.json`.
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
node index.js --auto --type poll-votes --season Verano
node index.js --auto --type poll-votes --poll-question "Quienes juegan hoy?"
```

## Notes

- Interactive mode starts the menu for sending messages, pictures, and poll actions manually.
- Automated `convocatoria` renders the configured template, sends the message to the configured group, optionally sends `reglamento.md`, creates the poll, votes on it, and increments the selected season `WEEK_NUMBER`.
- Automated `convocados` sends the configured message file to the configured group.
- Automated `poll-votes` looks up the configured poll, fetches the voters for the configured yes-answer option, prints the voter list, and adds missing voters to `puntuacion.json` with the default score.
- Automated flows open a visible WhatsApp Web session in Chromium and reuse the authenticated local session managed by `LocalAuth`.