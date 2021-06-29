# server-monitor-slack-bot-public

(*Go to master branch to view code.)

This slack bot monitors through a given list of servers (in node_list.json file) every 5 minutes,
checks whether all servers' nodes are in sync,
and if a node has 3 consecutive errors,
sends its error message to a given list of slack channels (in slack_config.json file).

In order to run this bot, one should:
1. install its dependencies. (main dependencies are 'axios', 'ethers', and 'pm2')
2. fill in the slack_config.json and node_list.json file.
3. run 'pm2 start ServerMonitorSlackBot.js' on terminal.
