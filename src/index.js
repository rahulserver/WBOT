const puppeteer = require('puppeteer-core');
const _cliProgress = require('cli-progress');
require("./welcome");
var spinner = require("./step");
var utils = require("./utils");
var qrcode = require('qrcode-terminal');
var path = require("path");
var argv = require('yargs').argv;
var rev = require("./detectRev");
var constants = require("./constants");
var configs = require("../bot");
const linkPreviewGenerator = require("link-preview-generator");
const image2base64 = require('image-to-base64');

//console.log(ps);

//console.log(process.cwd());

async function Main() {

    try {
        //console.log(configs);
        var page;
        await downloadAndStartThings();
        var isLogin = await checkLogin();
        if (!isLogin) {
            await getAndShowQR();
        }
        console.log("WBOT is ready !! Let those message come.");
    } catch (e) {
        console.error("\nLooks like you got an error. " + e);
        try {
            page.screenshot({ path: path.join(process.cwd(), "error.png") })
        } catch (s) {
            console.error("Can't create shreenshot, X11 not running?. " + s);
        }
        console.warn(e);
        console.error("Don't worry errors are good. They help us improve. A screenshot has already been saved as error.png in current directory. Please mail it on vasani.arpit@gmail.com along with the steps to reproduce it.\n");
        throw e;
    }

    /**
     * If local chrome is not there then this function will download it first. then use it for automation. 
     */
    async function downloadAndStartThings() {
        let botjson = utils.externalInjection("bot.json");
        var appconfig = await utils.externalInjection("bot.json");
        appconfig = JSON.parse(appconfig);
        spinner.start("Downloading chrome\n");
        const browserFetcher = puppeteer.createBrowserFetcher({
            path: process.cwd()
        });
        const progressBar = new _cliProgress.Bar({}, _cliProgress.Presets.shades_grey);
        progressBar.start(100, 0);
        var revNumber = await rev.getRevNumber();
        const revisionInfo = await browserFetcher.download(revNumber, (download, total) => {
            //console.log(download);
            var percentage = (download * 100) / total;
            progressBar.update(percentage);
        });
        progressBar.update(100);
        spinner.stop("Downloading chrome ... done!");
        //console.log(revisionInfo.executablePath);
        spinner.start("Launching Chrome");
        var pptrArgv = [];
        if (argv.proxyURI) {
            pptrArgv.push('--proxy-server=' + argv.proxyURI);
        }
        const extraArguments = Object.assign({});
        extraArguments.userDataDir = constants.DEFAULT_DATA_DIR;
        const browser = await puppeteer.launch({
            executablePath: revisionInfo.executablePath,
            headless: appconfig.appconfig.headless,
            userDataDir: path.join(process.cwd(), "ChromeSession"),
            devtools: false,
            args: [...constants.DEFAULT_CHROMIUM_ARGS, ...pptrArgv], ...extraArguments
        });
        spinner.stop("Launching Chrome ... done!");
        if (argv.proxyURI) {
            spinner.info("Using a Proxy Server");
        }
        spinner.start("Opening Whatsapp");
        page = await browser.pages();
        if (page.length > 0) {
            page = page[0];
            page.setBypassCSP(true);
            if (argv.proxyURI) {
                await page.authenticate({ username: argv.username, password: argv.password });
            }
            page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36");
            await page.goto('https://web.whatsapp.com', {
                waitUntil: 'networkidle0',
                timeout: 0
            });
            //console.log(contents);
            //await injectScripts(page);
            botjson.then((data) => {
                page.evaluate("var intents = " + data);
                //console.log(data);
            }).catch((err) => {
                console.log("there was an error \n" + err);
            });
            spinner.stop("Opening Whatsapp ... done!");
            page.exposeFunction("log", (message) => {
                console.log(message);
            })
            page.exposeFunction("getFile", utils.getFileInBase64);
        }
    }

    async function injectScripts(page) {
        return await page.waitForSelector('[data-icon=laptop]')
            .then(async () => {
                await page.addScriptTag({
                    content: `
                var previewData = ${JSON.stringify({
                    text: configs.bot.message.text
                })}
            `});

                try {
                    if (configs.bot.message.link) {
                        const previewData = await linkPreviewGenerator(configs.bot.message.link);
                        if (previewData.img) {
                            var imgbase64 = await image2base64(previewData.img);
                            previewData.thumb = imgbase64;
                            previewData.url = configs.bot.message.link;
                            previewData.text = configs.bot.message.text;
                            await page.addScriptTag({
                                content: `
                            var previewData = ${JSON.stringify(previewData)}
                        `});
                        }
                    }

                } catch (error) {
                    console.log("error getting preview data for link: " + configs.bot.message.link, error);

                }
                var filepath = path.join(__dirname, "WAPI.js");
                await page.addScriptTag({ path: require.resolve(filepath) });
                filepath = path.join(__dirname, "inject.js");
                await page.addScriptTag({ path: require.resolve(filepath) });
                return true;
            })
            .catch(() => {
                console.log("User is not logged in. Waited 30 seconds.");
                return false;
            })
    }

    async function checkLogin() {
        spinner.start("Page is loading");
        //TODO: avoid using delay and make it in a way that it would react to the event. 
        await utils.delay(10000);
        //console.log("loaded");
        var output = await page.evaluate("localStorage['last-wid']");
        //console.log("\n" + output);
        if (output) {
            spinner.stop("Looks like you are already logged in");
            await injectScripts(page);
        } else {
            spinner.info("You are not logged in. Please scan the QR below");
        }
        return output;
    }

    //TODO: add logic to refresh QR.
    async function getAndShowQR() {
        //TODO: avoid using delay and make it in a way that it would react to the event. 
        //await utils.delay(10000);
        var scanme = "img[alt='Scan me!'], canvas";
        await page.waitForSelector(scanme);
        var imageData = await page.evaluate(`document.querySelector("${scanme}").parentElement.getAttribute("data-ref")`);
        //console.log(imageData);
        qrcode.generate(imageData, { small: true });
        spinner.start("Waiting for scan \nKeep in mind that it will expire after few seconds");
        var isLoggedIn = await injectScripts(page);
        while (!isLoggedIn) {
            //console.log("page is loading");
            //TODO: avoid using delay and make it in a way that it would react to the event. 
            await utils.delay(300);
            isLoggedIn = await injectScripts(page);
        }
        if (isLoggedIn) {
            spinner.stop("Looks like you are logged in now");
            //console.log("Welcome, WBOT is up and running");
        }
    }

}

Main();
