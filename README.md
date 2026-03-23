# sendMessageOnWhatsApp
Sends message to a contact or group on WhatsApp

## Web JS CLI help

The Web.js entrypoint now supports a built-in help option:

```bash
node webJsApp/index.js --help
```

The help content is stored in [webJsApp/CLI_HELP.md](c:/Development/GitHub/sendMessageOnWhatsApp/webJsApp/CLI_HELP.md) so CLI instructions can be updated without changing code.

The same pattern is available in the other app variants:

```bash
node jsApp/index.js --help
python pythonApp/main.py --help
```

The JS, TS, and Python help text lives beside each entrypoint in these files:

- [jsApp/CLI_HELP.md](c:/Development/GitHub/sendMessageOnWhatsApp/jsApp/CLI_HELP.md)
- [tsApp/CLI_HELP.md](c:/Development/GitHub/sendMessageOnWhatsApp/tsApp/CLI_HELP.md)
- [pythonApp/CLI_HELP.md](c:/Development/GitHub/sendMessageOnWhatsApp/pythonApp/CLI_HELP.md)

## Config profiles

`config.json` now stores named profiles at the top level, including `FFCH` and `TEST`.

- The default runtime profile is `FFCH`.
- Pass `--test` to any app entrypoint to use the `TEST` profile instead.
- The Web.js automated flows now read and update the selected profile under `config.json` instead of assuming a single top-level configuration.
