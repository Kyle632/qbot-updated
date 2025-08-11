import { ActivityType } from 'discord.js';
import { BotConfig } from './structures/types'; 

export const config: BotConfig = {
    groupId: 34761603,
    slashCommands: true,
    legacyCommands: {
        enabled: true,
        prefixes: ['q!'],
    },
    permissions: {
        all: ['1404223913638236240'],
        ranking: [''],
        users: [''],
        shout: [''],
        join: [''],
        signal: [''],
        admin: [''],
    },
    logChannels: {
        actions: '',
        shout: '',
    },
    api: false,
    maximumRank: 255,
    verificationChecks: false,
    bloxlinkGuildId: '',
    firedRank: 1,
    suspendedRank: 1,
    recordManualActions: true,
    memberCount: {
        enabled: false,
        channelId: '',
        milestone: 100,
        onlyMilestones: false,
    },
    xpSystem: {
        enabled: true,
        autoRankup: true,
        roles: [],
    },
    antiAbuse: {
        enabled: false,
        clearDuration: 1 * 60,
        threshold: 10,
        demotionRank: 1,
    },
    activity: {
        enabled: true,
        type: ActivityType.Watching,
        value: 'yeah uhm, too cool for school :shades:',
    },
    status: 'online',
    deleteWallURLs: false,
}
