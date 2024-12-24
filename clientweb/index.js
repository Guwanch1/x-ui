import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import QueryString from 'qs';
import dotenv from 'dotenv';

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
        let array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, array));
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
const baseUrl = process.env.BASE_URL;
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
        'Content-Type': 'application/x-www-form-urlencoded', 
        'Authorization': process.env.BEARER, 
        'Cookie': process.env.COOKIE
    }
};


app.get('/', async (req, res) => {
    // Get data from API
    config.data = credentials;
    config.url = baseUrl + 'list';
    axios.request(config).then((response) => {
        res.render('index.ejs', { data: response.data });
    }).catch((error) => {
        console.log(error);
        res.end('error');
    });

});

app.post('/generate', async (req, res) => {

    let rdata = req.body;

    let id = rdata.inboundId.split('?')[0];
    let protocol = rdata.inboundId.split('?')[1];
   
    if(protocol == 'vless') {

        config.url = baseUrl + 'addClient';
    
        config.data = qs.stringify({
            username: process.env.USERNAME,
            password: process.env.PASSWORD,
            id: id,
            settings: JSON.stringify({
                clients: [
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
                ]
            })
        });

        axios.request(config).then((response) => {
            console.log(response.data);
            if(response.data.success) {
                res.end('Success');
            } else {
                console.log(response.data.msg);
                res.end('Failed');
            }
        }).catch((error) => {
            console.log(error);
        });

    }else {
        res.end('We are working on it');
    }
    


});

app.get('/code', (req, res) => {
    
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