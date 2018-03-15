# Jet printer waste ink counter modification tool

## Supported printers

* Epson XP-435 (XP-432)

## Counter modification tool

```sh
npm run count <ip-addr> dev             # Get device info
npm run count <ip-addr> get             # Get counter values in percents
npm run count <ip-addr> set <c1> <c2>   # Set counter values in percents
```

## Adding printers support

To help me to add new printer you need capturing SNMP traffic when reading counter values at least.
After capturing using Wireshark you need export it in JSON to analyze.

Also you need to get readed counter values in percentages to determine waste ink counters thresholds.

By example you can parse captures like this:

```sh
npm run parse capture/dev.json
npm run parse capture/get.json
npm run parse capture/set.json
```
