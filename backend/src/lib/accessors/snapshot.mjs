import { Data } from './data.mjs';

export class Snapshot extends Data {
  static schema = 'global';
  static table = 'snapshot';
  static columns = {
    ...Data.columns,
    user_id: Number,
    repo_id: Number,
    branch_name: String,
    commit_id: String,
    head: Boolean,
    ptime: String,
  };
  static criteria = {
    ...Data.criteria,
    user_id: Number,
    repo_id: Number,
    branch_name: String,
    commit_id: String,
    head: Boolean,
  };
  static eventColumns = {
    ...Data.eventColumns,
    repo_id: Number,
    branch_name: String,
    commit_id: String,
    head: Boolean,
  };
  static version = 3;

  /**
   * Create table in schema
   *
   * @param  {Database} db
   * @param  {string} schema
   */
  static async create(db, schema) {
    const table = this.getTableName(schema);
    const sql = `
      CREATE TABLE ${table} (
        id serial,
        gn int NOT NULL DEFAULT 1,
        deleted boolean NOT NULL DEFAULT false,
        ctime timestamp NOT NULL DEFAULT NOW(),
        mtime timestamp NOT NULL DEFAULT NOW(),
        details jsonb NOT NULL DEFAULT '{}',
        user_id int NOT NULL,
        repo_id int NOT NULL,
        branch_name text NOT NULL DEFAULT '',
        commit_id text NOT NULL DEFAULT '',
        head bool NOT NULL DEFAULT false,
        ptime timestamp,
        PRIMARY KEY (id)
      );
      CREATE INDEX ON ${table} (repo_id, branch_name) WHERE deleted = false AND head = true;
      CREATE UNIQUE INDEX ON ${table} (repo_id, branch_name, commit_id) WHERE deleted = false;
    `;
    await db.execute(sql);
  }

  /**
   * Upgrade table in schema to given DB version (from one version prior)
   *
   * @param  {Database} db
   * @param  {string} schema
   * @param  {number} version
   *
   * @return {boolean}
   */
  static async upgrade(db, schema, version) {
    if (version === 3) {
      await this.create(db, schema);
      await this.grant(db, schema);
      return true;
    }
    return false;
  }

  /**
   * Grant privileges to table to appropriate Postgres users
   *
   * @param  {Database} db
   * @param  {string} schema
   */
  static async grant(db, schema) {
    const table = this.getTableName(schema);
    const sql = `
      GRANT INSERT, SELECT, UPDATE ON ${table} TO admin_role;
      GRANT SELECT ON ${table} TO client_role;
    `;
    await db.execute(sql);
  }

  /**
   * Attach triggers to the table.
   *
   * @param  {Database} db
   * @param  {string} schema
   */
  static async watch(db, schema) {
    await this.createChangeTrigger(db, schema);
    await this.createNotificationTriggers(db, schema);
  }

  /**
   * See if a database change event is relevant to a given user
   *
   * @param  {Object} event
   * @param  {User} user
   * @param  {Subscription} subscription
   *
   * @return {boolean}
   */
  static isRelevantTo(event, user, subscription) {
    return (subscription.area === 'admin');
  }

  /**
   * Export database row to client-side code, omitting sensitive or
   * unnecessary information
   *
   * @param  {Database} db
   * @param  {string} schema
   * @param  {Object[]} rows
   * @param  {Object} credentials
   * @param  {Object} options
   *
   * @return {Object[]}
   */
  static async export(db, schema, rows, credentials, options) {
    const objects = await super.export(db, schema, rows, credentials, options);
    for (let [ index, object ] of objects.entries()) {
      const row = rows[index];
      object.user_id = row.user_id;
      object.repo_id = row.repo_id;
      object.branch_name = row.branch_name;
      object.commit_id = row.commit_id;
      object.head = row.head;
      object.ptime = row.ptime;
    }
    return objects;
  }
}
