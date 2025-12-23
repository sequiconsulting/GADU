import { BranchType, UserPrivilege, AppUser } from '../types';

/**
 * Permission checking utilities
 * Privilege codes:
 * - AD = Admin (full access, can manage users)
 * - CR = Craft Read (read-only Craft)
 * - MR = Mark Read (read-only Mark)
 * - AR = Chapter/Ark Read (read-only Chapter)
 * - RR = RAM Read (read-only RAM)
 * - CW = Craft Write (read-write Craft)
 * - MW = Mark Write (read-write Mark)
 * - AW = Chapter/Ark Write (read-write Chapter)
 * - RW = RAM Write (read-write RAM)
 */

/**
 * Check if user has admin privilege
 */
export const canAdminister = (user: AppUser | null): boolean => {
  if (!user) return false;
  return user.privileges.includes('AD');
};

/**
 * Check if user can read a specific branch
 */
export const canReadBranch = (user: AppUser | null, branch: BranchType): boolean => {
  if (!user) return false;
  if (user.privileges.includes('AD')) return true; // Admin can read everything

  const readPrivileges: Record<BranchType, UserPrivilege[]> = {
    'CRAFT': ['CR', 'CW'],
    'MARK': ['MR', 'MW'],
    'CHAPTER': ['AR', 'AW'],
    'RAM': ['RR', 'RW'],
  };

  return user.privileges.some(p => readPrivileges[branch].includes(p));
};

/**
 * Check if user can write to a specific branch
 */
export const canWriteBranch = (user: AppUser | null, branch: BranchType): boolean => {
  if (!user) return false;
  if (user.privileges.includes('AD')) return true; // Admin can write everything

  const writePrivileges: Record<BranchType, UserPrivilege[]> = {
    'CRAFT': ['CW'],
    'MARK': ['MW'],
    'CHAPTER': ['AW'],
    'RAM': ['RW'],
  };

  return user.privileges.some(p => writePrivileges[branch].includes(p));
};

/**
 * Get list of branches user can read
 */
export const getReadableBranches = (user: AppUser | null): BranchType[] => {
  if (!user) return [];
  if (user.privileges.includes('AD')) return ['CRAFT', 'MARK', 'CHAPTER', 'RAM'];

  const branches: BranchType[] = [];
  if (user.privileges.some(p => ['CR', 'CW'].includes(p))) branches.push('CRAFT');
  if (user.privileges.some(p => ['MR', 'MW'].includes(p))) branches.push('MARK');
  if (user.privileges.some(p => ['AR', 'AW'].includes(p))) branches.push('CHAPTER');
  if (user.privileges.some(p => ['RR', 'RW'].includes(p))) branches.push('RAM');

  return branches;
};

/**
 * Get list of branches user can write to
 */
export const getWritableBranches = (user: AppUser | null): BranchType[] => {
  if (!user) return [];
  if (user.privileges.includes('AD')) return ['CRAFT', 'MARK', 'CHAPTER', 'RAM'];

  const branches: BranchType[] = [];
  if (user.privileges.includes('CW')) branches.push('CRAFT');
  if (user.privileges.includes('MW')) branches.push('MARK');
  if (user.privileges.includes('AW')) branches.push('CHAPTER');
  if (user.privileges.includes('RW')) branches.push('RAM');

  return branches;
};

/**
 * Check if user can view admin panel
 */
export const canViewAdminPanel = (user: AppUser | null): boolean => {
  if (!user) return false;
  return user.privileges.includes('AD');
};

/**
 * Check if user can modify admin settings
 */
export const canModifyAdminSettings = (user: AppUser | null): boolean => {
  if (!user) return false;
  return user.privileges.includes('AD');
};

/**
 * Check if user can manage users (add, edit, delete)
 */
export const canManageUsers = (user: AppUser | null): boolean => {
  if (!user) return false;
  return user.privileges.includes('AD');
};

/**
 * Check if user can view user management (read-only or write)
 */
export const canViewUserManagement = (user: AppUser | null): boolean => {
  if (!user) return false;
  return user.privileges.includes('AD');
};

/**
 * Check if user can create a member
 */
export const canCreateMember = (user: AppUser | null): boolean => {
  if (!user) return false;
  const writableBranches = getWritableBranches(user);
  return writableBranches.length > 0;
};

/**
 * Check if user can modify a specific member's branch data
 */
export const canModifyMemberBranch = (user: AppUser | null, branch: BranchType): boolean => {
  return canWriteBranch(user, branch);
};

/**
 * Check if user can delete a member (admin only)
 */
export const canDeleteMember = (user: AppUser | null): boolean => {
  return canAdminister(user);
};

/**
 * Check if user can change ritual configuration (admin only)
 */
export const canChangeRitual = (user: AppUser | null): boolean => {
  return canAdminister(user);
};

/**
 * Check if user can view reports (print, export, etc.)
 * Users with any read or write privilege can view reports
 */
export const canViewReports = (user: AppUser | null): boolean => {
  if (!user) return false;
  if (user.privileges.includes('AD')) return true;
  return user.privileges.length > 0; // Any privilege allows report viewing
};

/**
 * Get user permission summary for debugging/logging
 */
export const getPermissionSummary = (user: AppUser | null): string => {
  if (!user) return 'No user';
  if (canAdminister(user)) return 'Admin - Full Access';

  const readableBranches = getReadableBranches(user).join(', ');
  const writableBranches = getWritableBranches(user).join(', ');

  if (!readableBranches && !writableBranches) return 'No permissions';

  let summary = '';
  if (readableBranches) summary += `Read: ${readableBranches}`;
  if (writableBranches) summary += (summary ? '; ' : '') + `Write: ${writableBranches}`;

  return summary;
};
