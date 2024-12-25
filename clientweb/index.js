import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import QueryString from 'qs';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import crypto from 'crypto';

const seq = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

class RandomUtil {
    static randomIntRange(min, max) {
        return parseInt(Math.random() * (max - min) + min, 10);
    }

    static randomInt(n) {
        return this.randomIntRange(0, n);
    }

    static randomSeq(count) {
        let str = '';
        for (let i = 0; i < count; ++i) {
            str += seq[this.randomInt(62)];
        }
        return str;
    }

    static randomLowerAndNum(count) {
        let str = '';
        for (let i = 0; i < count; ++i) {
            str += seq[this.randomInt(36)];
        }
        return str;
    }

    static randomUUID() {
        let d = new Date().getTime();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c === 'x' ? r : (r & 0x7 | 0x8)).toString(16);
        });
    }

    static randomShadowsocksPassword() {
        const array = crypto.randomBytes(32); 
        return Buffer.from(array).toString('base64');
    }

    static randomShortId() {
        let shortIds = new Array(24).fill('');
        for (var ii = 1; ii < 24; ii++) {
            for (var jj = 0; jj <= this.randomInt(7); jj++){
                let randomNum = this.randomInt(256);
                shortIds[ii] += ('0' + randomNum.toString(16)).slice(-2)
            }
        }
        return shortIds;
    }
}

dotenv.config();

const app = express();
const port = 3000;
const qs = QueryString;
const basePort = process.env.PORT;
const secretURL = process.env.SECRET;
const host = process.env.HOST;
const baseUrl = `http://${process.env.HOST}:${process.env.PORT}/${process.env.SECRET}/xui/inbound/`;

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));


let credentials = qs.stringify({
    'username': process.env.USERNAME,
    'password': process.env.PASSWORD
});

let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: baseUrl,
    headers: { 
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    withCredentials: true
};

async function xuiLogin() {
    try {
        config.url = `http://${host}:${basePort}/${secretURL}/login`;
        config.data = credentials;
        const response = await axios.request(config);
        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
            config.headers['Cookie'] = setCookieHeader;
        } else {
            console.log('No cookies received in the response.');
        }
    } catch (error) {
        console.error('Error logging in:', error.message);
    }
}

await xuiLogin();



async function getInbounds() {

    try {
        config.data = credentials;
        config.url = baseUrl + 'list/';
        let response = await axios.request(config);
        return response.data;

    } catch (error) {
        console.error(error);
    }


}

function generateVLESSClientCode({ uuid, address, port, security = "none", type = "tcp", pbk = "", fp = "chrome", 
    flow = "", sni = "", remarks = "VLESS_Client"
}) {

    const params = new URLSearchParams();

    params.append("type", type);
    params.append("security", security);
    params.append("pbk", pbk);
    params.append("fp", fp);

    if (flow) params.append("flow", flow);
    if (sni) params.append("sni", sni);

    // Construct the VLESS URI
    const uri = `vless://${uuid}@${address}:${port}?${params.toString()}#${encodeURIComponent(remarks)}`;
    return uri;
}

function generateShadowsocksClientCode(method, password, clientPassword, server, port, remark = "Shadowsocks_Client") {
    const methodPassword = `${method}:${password}:${clientPassword}`;
    const encodedMethodPassword = Buffer.from(methodPassword).toString('base64');
    return `ss://${encodedMethodPassword}@${server}:${port}#${remark}`;
}

const generatorQR = async text => {
    try {
        let res = await QRCode.toDataURL(text);
        return res;
    } catch (err) {
        console.error(err);
    }
}

app.get('/', async (req, res) => {
    res.render('index.ejs', { data:  await getInbounds() });
});

app.post('/generate', async (req, res) => {

    let rdata = req.body;

    let id = rdata.inboundId.split('?')[0];
    let protocol = rdata.inboundId.split('?')[1];


    config.url = baseUrl + 'addClient';
   
    if(protocol == 'vless') {

        let clients = [
            {
                id: RandomUtil.randomUUID(),
                flow: 'xtls-rprx-vision',
                email: RandomUtil.randomLowerAndNum(9),
                totalGB: 0,
                expiryTime: 0,
                enable: true,
                tgId: rdata.tgId,
                subId: RandomUtil.randomLowerAndNum(16),
                reset: 0 
            }
        ];
    
        config.data = qs.stringify({
            username: process.env.USERNAME,
            password: process.env.PASSWORD,
            id: id,
            settings: JSON.stringify({
                clients: clients
            })
        });

        axios.request(config).then((response) => {
            if(response.data.success) {
                res.redirect('/code/vless/' + clients[0].email);
            } else {
                console.error(response.data.msg);
                res.end('Failed');
            }
        }).catch((error) => {
            console.error(error);
        });




    }else if(protocol == 'shadowsocks') {
        
        let clients = {
            "clients": [
              {
                "method": "",
                "password": RandomUtil.randomShadowsocksPassword(),
                "email": RandomUtil.randomLowerAndNum(9),
                "totalGB": 0,
                "expiryTime": 0,
                "enable": true,
                "tgId": rdata.tgId,
                "subId": RandomUtil.randomLowerAndNum(16),
                "reset": 0
              }
            ]
        };

        config.data = qs.stringify({
            username: process.env.USERNAME,
            password: process.env.PASSWORD,
            id: id,
            settings: JSON.stringify(clients)
        });

        axios.request(config).then((response) => {
            if(response.data.success) {
                res.redirect('/code/shadowsocks/'  + clients.clients[0].email);
            } else {
                console.error(response.data);
                res.end('Failed');
            }
        }).catch((error) => {
            console.error(error);
        });
        
    }else {
        res.end('We are working on it');
    }
    


});

app.get('/code/:protocol/:email', async (req, res) => {
    let email = req.params.email;
    let inbounds = await getInbounds();
    if(req.params.protocol == 'vless') {
        inbounds.obj.forEach(async inbound => {
            let inboundSettings = JSON.parse(inbound.settings);
            inboundSettings.clients.forEach(async client => {
                if(client.email == email) {
                    let streamSettings = JSON.parse(inbound.streamSettings);
                    let link = generateVLESSClientCode({
                        uuid: client.id,
                        address: process.env.HOST,
                        port: inbound.port,
                        type: streamSettings.network,
                        security: streamSettings.security,
                        pbk: streamSettings.realitySettings.settings.publicKey,
                        fp: streamSettings.realitySettings.settings.fingerprint,
                        sni: streamSettings.realitySettings.serverNames[0],
                        flow: client.flow,
                        remarks: "libertatem"
                    });
                    let qr = await generatorQR(link);
                    res.render('code.ejs', { link: link, qr: qr });
                    return;
                }
            });

        });
    }else if(req.params.protocol == 'shadowsocks') {
        inbounds.obj.forEach(async inbound => {
            let inboundSettings = JSON.parse(inbound.settings);
            inboundSettings.clients.forEach(async client => {
                if(client.email == email) {
                    let link = generateShadowsocksClientCode(inboundSettings.method, inboundSettings.password, client.password, process.env.HOST, inbound.port, 'socks');
                    let qr = await generatorQR(link);
                    res.render('code.ejs', { link: link, qr: qr });
                    return;
                }
            });

        });
    }
});


app.get('/login', (req, res) => {
    res.render('login.ejs');
});

app.get('/register', (req, res) => {
    res.render('register.ejs');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});