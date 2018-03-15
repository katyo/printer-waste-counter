import { readFileSync } from 'fs';
import 'colors';
const { parse } = JSON;

const { argv, exit } = process;

if (argv.length != 3) {
    console.log('Usage: npm run parse disection.json');
    exit(1);
}

const [, , disection_json] = argv;

const disection_data = parse(readFileSync(disection_json).toString('utf8'));

const names: Record<string, string> = {
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.118.105.1.0.0': "firmware-version",
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.115.116.1.0.1': "device-state-2",

    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.7.0.133.5.65.190.160.24.0': 'c1-lo',
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.7.0.133.5.65.190.160.25.0': 'c1-hi',
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.7.0.133.5.65.190.160.30.0': 'c1-ex',
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.7.0.133.5.65.190.160.26.0': 'c2-lo',
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.7.0.133.5.65.190.160.27.0': 'c2-hi',
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.7.0.133.5.65.190.160.34.0': 'c2-ex',

    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.16.0.133.5.66.189.33.24.0.*.81.112.109.122.121.102.111.98': "c1-lo 24.0.*",
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.16.0.133.5.66.189.33.25.0.*.81.112.109.122.121.102.111.98': "c1-hi 25.0.*",
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.16.0.133.5.66.189.33.30.0.0.81.112.109.122.121.102.111.98': "c1-ex 30.0.0",
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.16.0.133.5.66.189.33.28.0.0.81.112.109.122.121.102.111.98': "28.0.0 ?",
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.16.0.133.5.66.189.33.29.0.0.81.112.109.122.121.102.111.98': "29.0.0 ?",
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.16.0.133.5.66.189.33.46.0.94.81.112.109.122.121.102.111.98': "46.0.94 ?",
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.16.0.133.5.66.189.33.26.0.*.81.112.109.122.121.102.111.98': "c2-lo 26.0.*",
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.16.0.133.5.66.189.33.27.0.*.81.112.109.122.121.102.111.98': "c2-hi 27.0.*",
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.16.0.133.5.66.189.33.34.0.0.81.112.109.122.121.102.111.98': "c2-ex 34.0.0",
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.16.0.133.5.66.189.33.47.0.94.81.112.109.122.121.102.111.98': "47.0.94 ?",
    '1.3.6.1.4.1.1248.1.2.2.44.1.1.2.1.124.124.16.0.133.5.66.189.33.49.0.0.81.112.109.122.121.102.111.98': "49.0.0 ?",

    '1.3.6.1.4.1.1248.1.1.3.1.1.5.0': "unknown-1",
};

function pretty_name(key: string): string {
    for (const name in names) {
        const re = new RegExp('^' + name.replace(/\./g, '\\.').replace(/\*/g, '(\\d+)') + '$');
        const m = key.match(re);
        let n = 1;
        if (m) return names[name].replace(/\*/g, () => m[n++].red);
    }
    return key;
}

function parse_name(key: string): string {
    return `<${pretty_name(key)}>`;
}

const chars: Record<string, string> = {
    '\t': '\\t',
    '\v': '\\v',
    '\f': '\\f',
    '\n': '\\n',
    '\r': '\\r',
    '\a': '\\a',
    '\b': '\\b',
    '\0': '\\0',
    '\\': '\\\\',
};

function parse_data(raw: string): string {
    return raw
        .split(/\:/)
        .map(xx => parseInt(xx, 16))
        .map(byte => {
            const char = String.fromCharCode(byte);
            const hex = byte.toString(16);
            return (byte >= 0x20 && byte <= 0x5b) || (byte >= 0x5d && byte <= 0x7e) ? char : chars[char] || `\\x${hex.length < 2 ? '0' + hex : hex}`;
        })
        .join('');
}

for (const { _source: { layers: { ip, udp, tcp, snmp, data } } } of disection_data) {
    //const dir = udp['udp.dstport'] == '3289' || udp['udp.dstport'] == "161" ? 'h -> p' : 'p -> h';
    const dir = ip['ip.src'] == "192.168.1.6" ? 'h'.magenta + ' -> ' + 'p'.red : 'p'.red + ' -> ' + 'h'.magenta;
    let out = '';
    if (snmp) {
        const data_tree = snmp['snmp.data_tree'];
        const get_req = data_tree['snmp.get_request_element'];
        const get_res = data_tree['snmp.get_response_element'];
        if (get_req || get_res) {
            out += `get:${get_req ? 'req' : 'res'}`.cyan;
            const var_bind = (get_req || get_res)['snmp.variable_bindings_tree'];
            //out += '\n' + JSON.stringify(var_bind, null, "  ");
            for (const k in var_bind) {
                const v = var_bind[k];
                out += ' ' + parse_name(v["snmp.name"]);
                out += ' [' + (v['snmp.value.null'] === '' ? 'null'.yellow : v['snmp.value.octets'] ? parse_data(v['snmp.value.octets']).green : '-') + ']';
            }
        }
    } else if (udp) {
        if (data) {
            out += parse_data(data['data.data']);
        } else {
            out += 'udp\n' + JSON.stringify(udp, null, "  ")
        }
    } else if (tcp) {
        out += 'tcp'.blue;
        if (data) {
            out += parse_data(data['data.data']);
        } else {
            //out += JSON.stringify(tcp, null, "  ");
        }
    }
    console.log(`${dir}: ${out}`);
}
