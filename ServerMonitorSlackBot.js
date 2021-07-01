var ethers = require('ethers');
var axios = require('axios');
var node_list = require('./node_list.json');
var slack_config = require('./slack_config.json');

// node_list data
var number_of_servers = node_list.servers.length;
var servers = node_list.servers;

// slack_config data
var number_of_channels = slack_config.channels.length;
var slackToken = slack_config.OAuthBotToken;
var slackChannels = slack_config.channels;

// promise that connects to a server and resolves its error info,
// if server node is out of sync OR eth_syncing command fails
function checkError (host, serverName) {
    return new Promise((resolve)=>{
        try {
            var customHttpProvider = new ethers.providers.JsonRpcProvider(host);

            // if node is synced, eth_syncing command returns false
            customHttpProvider.send("eth_syncing").then((result) => {

                // if node is synced:
                if (result.toString() === 'false') {
                    var syncStatus = 'true';
                    resolve([serverName, syncStatus]);

                // if node is out of sync:
                } else {
                    var syncStatus = 'false';
                    var currentBlock = parseInt(result.currentBlock.toString(),16).toString();
                    var highestBlock = parseInt(result.highestBlock.toString(),16).toString();
                    resolve([serverName, syncStatus, currentBlock, highestBlock, host]);
                }
            })

        // if eth_syncing command fails:
        } catch ( error ) {
            var syncStatus = "unknown"
            var errorName = error.toString()
            var errorStack = error.stack
            resolve([serverName, syncStatus, errorName, errorStack, host]);
        }
    })
}

// promise that recursively resolves servers
// with more than 3 consecutive errors and their error info
function checkConsecutiveError (errorInfo, errorCount) {
    return new Promise((resolve) => {
        var serverName = errorInfo[0];
        var host = errorInfo[4];

        if (errorInfo.length===2) {
            resolve (errorInfo);

        } else if (errorCount===3) {
            resolve (errorInfo);

        }  else if (errorCount===undefined) {
            var newErrorCount = 1;
            setTimeout(()=>{
                checkError(host, serverName).then((errorInfo)=>{
                    resolve (checkConsecutiveError(errorInfo,newErrorCount));
                })
            },30000);

        } else if (errorCount===1 || errorCount===2) {
            var newErrorCount = errorCount + 1;
            setTimeout(()=>{
                checkError(host, serverName).then((errorInfo)=>{
                    resolve (checkConsecutiveError(errorInfo,newErrorCount));
                })
            },30000);
        }
    })
}

// function that sends error message to slack channels
async function sendErrorMsg(consecutiveErrorInfo) {
    var serverName = consecutiveErrorInfo[0];
    var syncStatus = consecutiveErrorInfo[1]
    var host = consecutiveErrorInfo[4];

    const url = 'https://slack.com/api/chat.postMessage';

    // does nothing if no consecutive errors
    if (consecutiveErrorInfo.length===2){
        console.log(serverName + ": no error message b/c no consecutive errors")

    // sends error message if server node is out of sync
    } else if (syncStatus==="false") {
        var currentBlock = consecutiveErrorInfo[2];
        var highestBlock = consecutiveErrorInfo[3];
        // loop through all slack channels
        for (let i = 0; i < number_of_channels; i ++) {
            const res = await axios.post(url, {
                channel: slackChannels[i],
                text: serverName + ': ' + 'node is out of sync'
                    + "\n" + "current block: " + currentBlock
                    + "\n" + "highest block: " + highestBlock
                    + "\n" + "server host: " + host,
                username: 'server monitor bot',
                icon_emoji: ':computer:'
            }, {headers: {authorization: `Bearer ${slackToken}`}});
            console.log('Done', res.data);
        }

    // sends error message if server has "unknown" sync status b/c eth_syncing failed
    } else if (syncStatus==="unknown") {
        var errorName = consecutiveErrorInfo[2];
        var errorStack = consecutiveErrorInfo[3];
        // loop through all slack channels
        for (let i = 0; i < number_of_channels; i++) {
            const res = await axios.post(url, {
                channel: slackChannels[i],
                text: serverName + ': ' + 'can not monitor node status b/c of the following error'
                    + "\n" + "error name: " + errorName
                    + "\n" + "error stack: " + errorStack
                    + "\n" + "server host: " + host,
                username: 'server monitor bot',
                icon_emoji: ':computer:'
            }, {headers: {authorization: `Bearer ${slackToken}`}});
            console.log('Done', res.data);
        }
    }
}

// monitor server: check if server has consecutive errors and sends slack error message
async function monitorServer(host, serverName) {
    let errorInfo = await checkError(host, serverName);
    let consecutiveErrorInfo = await checkConsecutiveError(errorInfo);
    sendErrorMsg(consecutiveErrorInfo);
}

// monitor all servers
function monitorAllServers() {
    // loop through all servers
    for (let i = 0; i < number_of_servers; i++) {
        // every 1000ms=1s, monitor each server
        // (to make execution time always larger than pm2 default min-uptime 1s)
        setTimeout(()=>{
            monitorServer(servers[i].host, servers[i].serverName);
        },1000);
    }
}

// every 300000ms=5min, monitor all servers
setTimeout(()=>{
    monitorAllServers();
},1000)
