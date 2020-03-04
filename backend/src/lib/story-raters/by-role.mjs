import _ from 'lodash';

import { Role } from '../accessors/role.mjs';

export class ByRole {
  static type = 'by-role';
  static calculation = 'immediate';
  static columns = [ 'role_ids' ];
  static monitoring = [ 'role' ];
  static roleCache = [];

  /**
   * Load data needed to rate the given stories
   *
   * @param  {Database} db
   * @param  {Schema} schema
   * @param  {Array<Story>} stories
   * @param  {Listing} listing
   *
   * @return {Promise<Object>}
   */
  static async prepareContext(db, schema, stories, listing) {
    const roles = [];
    const roleIDs = _.filter(_.uniq(_.flatten(_.map(stories, 'role_ids'))));
    for (let roleID of roleIDs) {
      let role = this.findCachedRole(roleID);
      if (!role) {
        role = await this.loadRole(db, roleID);
      }
      if (role) {
        roles.push(role);
      }
    }
    return { roles };
  }

  /**
   * Give a numeric score to a story
   *
   * @param  {Object} context
   * @param  {Story} story
   *
   * @return {Number}
   */
  static calculateRating(context, story) {
    const roles = _.filter(context.roles, (role) => {
      return _.includes(story.role_ids, role.id);
    });
    const ratings = _.map(roles, (role) => {
      return _.get(role, 'settings.rating', 0);
    }, 0);
    return _.sum(ratings);
  }

  /**
   * Handle database change events
   *
   * @param  {Object} evt
   */
  static handleEvent(evt) {
    if (evt.table === 'role') {
      if (evt.diff.details) {
        this.clearCachedRole(evt.id);
      }
    }
  }

  /**
   * Load role from database, saving it to cache
   *
   * @param  {Database} db
   * @param  {Number} roleID
   *
   * @return {Object|null}
   */
  static async loadRole(db, roleID) {
    const criteria = {
      id: roleID,
      deleted: false,
    };
    const row = await Role.findOne(db, 'global', criteria, 'id, settings');
    if (row) {
      this.cacheRole(row);
    }
    return row;
  }

  /**
   * Save role to cache
   *
   * @param  {Object} role
   */
  static cacheRole(role) {
    this.roleCache.unshift(role);
    if (this.roleCache.length > 100) {
      this.roleCache.splice(100);
    }
  }

  /**
   * Find cached role
   *
   * @param  {Number} roleID
   *
   * @return {Object|null}
   */
  static findCachedRole(roleID) {
    const index = _.findIndex(this.roleCache, { id: roleID });
    if (index === -1) {
      return null;
    }
    const role = this.roleCache[index];
    this.roleCache.splice(index, 1);
    this.roleCache.unshift(role);
    return role;
  }

  /**
   * Remove an entry from cache
   *
   * @param  {Number} roleID
   */
  static clearCachedRole(roleID) {
    const index = _.findIndex(this.roleCache, { id: roleID });
    if (index === -1) {
      return;
    }
    this.roleCache.splice(index, 1);
  }
}