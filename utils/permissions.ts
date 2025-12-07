import { Auth0User, UserRole, BranchType } from '../types';

/**
 * Permission system for GADU role-based access control
 * 
 * Role hierarchy:
 * - admin_global: Full read/write access to all data
 * - admin_craft: Read all, write only Craft branch
 * - admin_mark_arch: Read all, write Mark & Chapter branches
 * - admin_ram: Read all, write only RAM branch
 * 
 * Users can have multiple roles.
 */

/**
 * Check if user has ANY of the specified roles
 */
export const hasRole = (user: Auth0User | null, roles: UserRole[]): boolean => {
  if (!user) return false;
  const userRoles = user['https://gadu.com/roles'] || [];
  return roles.some(role => userRoles.includes(role));
};

/**
 * Check if user has ALL of the specified roles
 */
export const hasAllRoles = (user: Auth0User | null, roles: UserRole[]): boolean => {
  if (!user) return false;
  const userRoles = user['https://gadu.com/roles'] || [];
  return roles.every(role => userRoles.includes(role));
};

/**
 * Check if user can write to a specific branch
 * - admin_global can write all branches
 * - admin_craft can write CRAFT only
 * - admin_mark_arch can write MARK and CHAPTER
 * - admin_ram can write RAM only
 */
export const canWriteToBranch = (user: Auth0User | null, branch: BranchType): boolean => {
  if (!user) return false;
  const userRoles = user['https://gadu.com/roles'] || [];

  if (userRoles.includes('admin_global')) return true;
  
  if (branch === 'CRAFT' && userRoles.includes('admin_craft')) return true;
  if ((branch === 'MARK' || branch === 'CHAPTER') && userRoles.includes('admin_mark_arch')) return true;
  if (branch === 'RAM' && userRoles.includes('admin_ram')) return true;

  return false;
};

/**
 * Check if user can read all data (always true for authenticated users)
 * This is implicit in all roles - they all have read access
 */
export const canRead = (user: Auth0User | null): boolean => {
  return user !== null;
};

/**
 * Check if user is global admin
 */
export const isGlobalAdmin = (user: Auth0User | null): boolean => {
  return hasRole(user, ['admin_global']);
};

/**
 * Get list of branches user can write to
 */
export const getWritableBranches = (user: Auth0User | null): BranchType[] => {
  if (!user) return [];
  const userRoles = user['https://gadu.com/roles'] || [];
  
  const branches: BranchType[] = [];
  
  if (userRoles.includes('admin_global')) {
    return ['CRAFT', 'MARK', 'CHAPTER', 'RAM'];
  }
  
  if (userRoles.includes('admin_craft')) branches.push('CRAFT');
  if (userRoles.includes('admin_mark_arch')) {
    branches.push('MARK', 'CHAPTER');
  }
  if (userRoles.includes('admin_ram')) branches.push('RAM');
  
  return branches;
};

/**
 * Check if user can save/modify a member
 * Returns true if user can write to at least one branch the member has data in
 */
export const canModifyMember = (user: Auth0User | null): boolean => {
  if (!user) return false;
  const userRoles = user['https://gadu.com/roles'] || [];
  
  // Any authenticated user with a write role can modify members
  const writeRoles: UserRole[] = ['admin_global', 'admin_craft', 'admin_mark_arch', 'admin_ram'];
  return userRoles.some(role => writeRoles.includes(role as UserRole));
};

/**
 * Check if user can create a new member
 * Only global admin or craft admin can create (members must have Craft data)
 */
export const canCreateMember = (user: Auth0User | null): boolean => {
  if (!user) return false;
  return hasRole(user, ['admin_global', 'admin_craft']);
};

/**
 * Check if user can delete a member
 * Only global admin can delete members
 */
export const canDeleteMember = (user: Auth0User | null): boolean => {
  return isGlobalAdmin(user);
};

/**
 * Check if user can modify admin settings
 * Only global admin
 */
export const canModifyAdminSettings = (user: Auth0User | null): boolean => {
  return isGlobalAdmin(user);
};

/**
 * Check if user can change ritual settings
 * Only global admin
 */
export const canChangeRitual = (user: Auth0User | null): boolean => {
  return isGlobalAdmin(user);
};

/**
 * Check if user can view inactive members archive
 * All authenticated users
 */
export const canViewInactiveMembers = (user: Auth0User | null): boolean => {
  return canRead(user);
};
