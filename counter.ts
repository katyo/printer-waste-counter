import {createSession} from 'net-snmp';
const { argv, env, exit } = process;

const version = 1;
const community = "public";

const oid_info_prefix = '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1';
const oid_firmware_version = '118.105.1.0.0';
const oid_device_status_2 = '115.116.1.0.1';

const oid_eeprom_get_prefix = '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.7.0.133.5.65.190.160';
const oid_eeprom_set_prefix = '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.16.0.133.5.66.189.33';
const oid_eeprom_set_suffix = '81.112.109.122.121.102.111.98';

const oid_counter_1_lo_byte = '24.0'; // [0x0018] = 0x00
const oid_counter_1_hi_byte = '25.0'; // [0x0019] = 0x00
const oid_counter_2_lo_byte = '26.0'; // [0x001a] = 0x00
const oid_counter_2_hi_byte = '27.0'; // [0x001b] = 0x00
const oid_counter_1_after_1 = '28.0'; // [0x001c] = 0x00
const oid_counter_1_after_2 = '29.0'; // [0x001d] = 0x00
const oid_counter_1_ex_byte = '30.0'; // [0x001e] = 0x00
const oid_counter_2_ex_byte = '34.0'; // [0x0022] = 0x00
const oid_counter_1_store = '46.0'; // [0x002e] = 0x5e
const oid_counter_2_store = '47.0'; // [0x002f] = 0x5e
const oid_counter_store = '49.0'; // [0x0031] = 0x00

function getRequest(snmp, id: string, cb: (err?: Error, val?: Buffer) => void) {
    console.debug('get_req', id);
    snmp.get([id], (err, res) => {
        if (err) return cb(err);
        const [{value}] = res;
        if (!Buffer.isBuffer(value)) return cb(new Error('no value'));
        const val = value.slice(1, -1).toString('ascii');
        console.debug('get_res', val);
        cb(undefined, val);
    });
}

function getFirmwareVersion(snmp, cb: (err?: Error, ver?: string) => void) {
    getRequest(snmp, `${oid_info_prefix}.${oid_firmware_version}`, (err, val) => {
        if (err) return cb(err);
        cb(undefined, val);
    });
}

function getDeviceStatus2(snmp, cb: (err?: Error, st2?: string) => void) {
    getRequest(snmp, `${oid_info_prefix}.${oid_device_status_2}`, (err, val) => {
        if (err) return cb(err);
        cb(undefined, val);
    });
}

function parseByteValue(buf: Buffer): number {
    const str = buf.toString('ascii').split(/\r\n/);
    const m: RegExpMatchesArray;
    if (str.length < 2 || str[0] != '@BDC PS' ||
        !(m = str[1].match(/^EE:[0-9A-F]{4}([0-9A-F]{2});$/)))
        throw new Error('invalid data');
    return parseInt(m[1], 16);
}

const counter1_threshold = 0xf96;
const counter2_threshold = 0xcb6;

function counterToPercent(threshold: number, lo: number, hi: number, ex: number): number {
    const raw = lo | (hi << 8) | (ex << 16);
    return raw * 100.0 / threshold;
}

function counterFromPercent(threshold: number, val: number): [number, number, number] {
    const raw = Math.round(val * threshold / 100.0);
    return [raw & 0xff, (raw >> 8) & 0xff, (raw >> 16) & 0xff];
}

function getByteValue(snmp, oid: string, cb: (err?: Error) => void) {
    getRequest(snmp, `${oid_eeprom_get_prefix}.${oid}`, (err, val) => {
        if (err) return cb(err);
        let byte;
        try {
            byte = parseByteValue(val);
        } catch(e) {
            cb(e);
        }
        cb(undefined, byte);
    });
}

function getCounterValues(snmp, cb: (err?: Error, val?: [number, number]) => void) {
    getByteValue(snmp, oid_counter_1_lo_byte, (err, c1_lo) => {
        if (err) return cb(err);
        getByteValue(snmp, oid_counter_1_hi_byte, (err, c1_hi) => {
            if (err) return cb(err);
            getByteValue(snmp, oid_counter_1_ex_byte, (err, c1_ex) => {
                if (err) return cb(err);
                getByteValue(snmp, oid_counter_2_lo_byte, (err, c2_lo) => {
                    if (err) return cb(err);
                    getByteValue(snmp, oid_counter_2_hi_byte, (err, c2_hi) => {
                        if (err) return cb(err);
                        getByteValue(snmp, oid_counter_2_ex_byte, (err, c2_ex) => {
                            if (err) return cb(err);
                            const c1_val = counterToPercent(counter1_threshold, c1_lo, c1_hi, c1_ex);
                            const c2_val = counterToPercent(counter2_threshold, c2_lo, c2_hi, c2_ex);
                            cb(undefined, [c1_val, c2_val]);
                        });
                    });
                });
            });
        });
    });
}

function setByteValue(snmp, oid: string, val: number, cb: (err?: Error) => void) {
    getRequest(snmp, `${oid_eeprom_set_prefix}.${oid}.${val}.${oid_eeprom_set_suffix}`, (err, val) => {
        if (err) return cb(err);
        if (val != '||:42:OK;') return cb(`Unable to set byte value: ${oid}.${val}`);
        cb();
    });
}

function setCounterValues(snmp, val: [number, number], cb: (err?: Error) => void) {
    const [c1_lo, c1_hi, c1_ex] = counterFromPercent(counter1_threshold, val[0]);
    const [c2_lo, c2_hi, c2_ex] = counterFromPercent(counter2_threshold, val[1]);
    setByteValue(snmp, oid_counter_1_lo_byte, c1_lo, (err?: Error) => {
        if (err) return cb(err);
        setByteValue(snmp, oid_counter_1_hi_byte, c1_hi, (err?: Error) => {
            if (err) return cb(err);
            setByteValue(snmp, oid_counter_1_ex_byte, c1_ex, (err?: Error) => {
                if (err) return cb(err);
                setByteValue(snmp, oid_counter_1_after_1, 0, (err?: Error) => {
                    if (err) return cb(err);
                    setByteValue(snmp, oid_counter_1_after_2, 0, (err?: Error) => {
                        if (err) return cb(err);
                        setByteValue(snmp, oid_counter_1_store, 94, (err?: Error) => {
                            if (err) return cb(err);
                            setByteValue(snmp, oid_counter_2_lo_byte, c2_lo, (err?: Error) => {
                                if (err) return cb(err);
                                setByteValue(snmp, oid_counter_2_hi_byte, c2_hi, (err?: Error) => {
                                    if (err) return cb(err);
                                    setByteValue(snmp, oid_counter_2_ex_byte, c2_ex, (err?: Error) => {
                                        if (err) return cb(err);
                                        setByteValue(snmp, oid_counter_2_store, 94, (err?: Error) => {
                                            if (err) return cb(err);
                                            setByteValue(snmp, oid_counter_store, 0, (err?: Error) => {
                                                if (err) return cb(err);
                                                cb();
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

console.debug = env['DEBUG'] ? (...args) => console.log(...args) : (() => {});

if (argv.length < 4) {
    console.log('Usage:');
    console.log('  npm run count <ip-addr> dev               Get device info');
    console.log('  npm run count <ip-addr> get               Get counter values');
    console.log('  npm run count <ip-addr> set <values...>   Set counter values');
    exit(0);
}

const host = argv[2];

const snmp = createSession(host, community);

function argParsePercent(arg?: string): number {
    if (arg) {
        const num = parseInt(arg, 10);
        return num < 0 ? 0 : num > 100 ? 100 : num;
    }
    return 0;
}

if (argv[3] == 'dev') {
    getFirmwareVersion(snmp, (err, ver) => {
        if (err) return console.error('Unable to read firmware version');
        console.log(`Firmware version: ${ver}`);
        getDeviceStatus2(snmp, (err, st2) => {
            if (err) return console.error('Unable to read device status!', err.message);
            console.log(`Device status: ${st2}`);
        });
    });
} else if (argv[3] == 'get') {
    getCounterValues(snmp, (err, val) => {
        if (err) return console.error('Unable to read counter values!', err.message);
        console.log(`Counter values: ${val[0].toPrecision(4)}% ${val[1].toPrecision(4)}%`);
    });
} else if (argv[3] == 'set') {
    const c1_val = argParsePercent(argv[4]);
    const c2_val = argParsePercent(argv[5]);
    console.log(`Set counters to: ${c1_val}% ${c2_val}%`);
    setCounterValues(snmp, [c1_val, c2_val], (err, val) => {
        if (err) return console.error('Unable to write counter values!', err.message);
        console.log('Please power off your device now to apply changes!');
    });
}
