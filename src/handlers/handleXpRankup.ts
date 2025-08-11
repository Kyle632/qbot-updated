import { config } from '../config';

const findEligibleRole = async (member: any, roles: any[], xp: number): Promise<any> => {
    const role = roles.find((role) => role.rank === config.xpSystem.roles.sort((a, b) => a.xp + b.xp).find((role) => xp >= role.xp)?.rank);
    if(role && (member.role.id === role.id || role.rank <= member.role.rank)) return null;
    return role;
}

export { findEligibleRole };
