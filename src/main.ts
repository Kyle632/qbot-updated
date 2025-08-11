import { QbotClient } from './structures/QbotClient';
import * as noblox from 'noblox.js';
import { handleInteraction } from './handlers/handleInteraction';
import { handleLegacyCommand } from './handlers/handleLegacyCommand';
import { config } from './config';
import { recordShout } from './events/shout';
import { checkSuspensions } from './events/suspensions';
import { recordAuditLogs } from './events/audit';
import { recordMemberCount } from './events/member';
import { clearActions } from './handlers/abuseDetection';
import { checkBans } from './events/bans';
import { checkWallForAds } from './events/wall';
require('dotenv').config();

// [Ensure Setup]
if(!process.env.ROBLOX_COOKIE) {
    console.error('ROBLOX_COOKIE is not set in the .env file.');
    process.exit(1);
}

require('./database');
require('./api');

// [Clients]
const discordClient = new QbotClient();
discordClient.login(process.env.DISCORD_TOKEN);
let robloxGroup: any = null;
(async () => {
    await noblox.setCookie(process.env.ROBLOX_COOKIE).catch(console.error);
    robloxGroup = await noblox.getGroup(config.groupId);
    
    // [Events]
    checkSuspensions();
    checkBans();
    if(config.logChannels.shout) recordShout();
    if(config.recordManualActions) recordAuditLogs();
    if(config.memberCount.enabled) recordMemberCount();
    if(config.antiAbuse.enabled) clearActions();
    if(config.deleteWallURLs) checkWallForAds();
})();

// [Handlers]
discordClient.on('interactionCreate', handleInteraction as any);
discordClient.on('messageCreate', handleLegacyCommand);

// [Module]
export { discordClient, noblox as robloxClient, robloxGroup };
