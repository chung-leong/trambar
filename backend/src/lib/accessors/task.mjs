import { Data } from './data.mjs';
import { HTTPError } from '../errors.mjs';

export class Task extends Data {
  static schema = 'both';
  static table = 'task';
  static columns = {
    ...Data.columns,
    action: String,
    token: String,
    options: Object,
    details: Object,
    completion: Number,
    failed: Boolean,
    user_id: Number,
    etime: String,
    seen: Boolean,
  };
  static criteria = {
    ...Data.criteria,
    action: String,
    token: String,
    completion: Number,
    failed: Boolean,
    seen: Boolean,
    user_id: Number,
    options: Object,
    etime: String,

    newer_than: String,
    older_than: String,
    complete: Boolean,
    noop: Boolean,
  };
  static eventColumns = {
    ...Data.eventColumns,
    action: String,
    failed: Boolean,
    user_id: Number,
  };
  static version = 3;

  /**
   * Create table in schema
   *
   * @param  {Database} db
   * @param  {String} schema
   *
   * @return {Promise}
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
        action varchar(64) NOT NULL,
        token varchar(64),
        options jsonb NOT NULL DEFAULT '{}',
        completion int NOT NULL DEFAULT 0,
        failed boolean NOT NULL DEFAULT false,
        seen boolean NOT NULL DEFAULT false,
        user_id int,
        etime timestamp,
        PRIMARY KEY (id)
      );
      CREATE UNIQUE INDEX ON ${table} (token) WHERE token IS NOT NULL AND deleted = false;
    `;
    await db.execute(sql);
  }

  /**
   * Upgrade table in schema to given DB version (from one version prior)
   *
   * @param  {Database} db
   * @param  {String} schema
   * @param  {Number} version
   *
   * @return {Promise<Boolean>}
   */
  static async upgrade(db, schema, version) {
    if (version === 3) {
      // adding: seen
      const table = this.getTableName(schema);
      const sql = `
        ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS
        seen boolean NOT NULL DEFAULT false;
        UPDATE ${table} SET seen = true;
      `;
      await db.execute(sql)
      return true;
    }
    return false;
  }

  /**
   * Attach triggers to the table.
   *
   * @param  {Database} db
   * @param  {String} schema
   *
   * @return {Promise}
   */
  static async watch(db, schema) {
    await this.createChangeTrigger(db, schema);
    await this.createNotificationTriggers(db, schema);
  }

  /**
   * Add conditions to SQL query based on criteria object
   *
   * @param  {Object} criteria
   * @param  {Object} query
   */
  static apply(criteria, query) {
    const { options, newer_than, older_than, complete, noop, ...basic } = criteria;
    super.apply(basic, query);

    const params = query.parameters;
    const conds = query.conditions;
    if (options !== undefined) {
      conds.push(`options @> $${params.push(options)}`);
    }
    if (newer_than !== undefined) {
      conds.push(`ctime > $${params.push(newer_than)}`);
    }
    if (older_than !== undefined) {
      conds.push(`ctime < $${params.push(older_than)}`);
    }
    if (complete !== undefined) {
      if (complete) {
        conds.push(`completion = 100`);
      } else {
        conds.push(`completion <> 100`);
      }
    }
    if (noop !== undefined) {
      if (noop) {
        conds.push(`completion = 0`);
      } else {
        conds.push(`completion > 0`);
      }
    }
  }

  /**
   * Export database row to client-side code, omitting sensitive or
   * unnecessary information
   *
   * @param  {Database} db
   * @param  {String} schema
   * @param  {Array<Object>} rows
   * @param  {Object} credentials
   * @param  {Object} options
   *
   * @return {Promise<Array<Object>>}
   */
  static async export(db, schema, rows, credentials, options) {
    const objects = await super.export(db, schema, rows, credentials, options);
    for (let [ index, object ] of objects.entries()) {
      // TODO: access control
      const row = rows[index];
      object.action = row.action;
      object.token = row.token;
      object.user_id = row.user_id;
      object.etime = row.etime;
      object.failed = row.failed;
      object.completion = row.completion;
      if (credentials.area === 'admin') {
        object.server_id = row.server_id;
        object.options = row.options;
        object.seen = row.seen;
      } else {
        delete object.details;
      }
    }
    return objects;
  }

  /**
   * See if a database change event is relevant to a given user
   *
   * @param  {Object} event
   * @param  {User} user
   * @param  {Subscription} subscription
   *
   * @return {Boolean}
   */
  static isRelevantTo(event, user, subscription) {
    if (super.isRelevantTo(event, user, subscription)) {
      if (event.current.user_id) {
        if (event.current.user_id === user.id) {
          return true;
        }
      } else {
        if (subscription.area === 'admin') {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Throw if current user cannot make modifications
   *
   * @param  {Object} taskReceived
   * @param  {Object} taskBefore
   * @param  {Object} credentials
   */
  static checkWritePermission(taskReceived, taskBefore, credentials) {
    if (!credentials.unrestricted) {
      if (taskBefore) {
        // task cannot be modified
        throw new HTTPError(400);
      }
      if (taskReceived.user_id !== credentials.user.id) {
        throw new HTTPError(403);
      }
    }
  }

  /**
   * Create a trigger on this table that updates another table
   *
   * @param  {Database} db
   * @param  {String} schema
   * @param  {String} triggerName
   * @param  {String} method
   * @param  {Array<String>} args
   *
   * @return {Promise}
   */
  static async createUpdateTrigger(db, schema, triggerName, method, args) {
    const table = this.getTableName(schema);
    const sql = `
      DROP TRIGGER IF EXISTS "${triggerName}" ON ${table};
      CREATE TRIGGER "${triggerName}"
      AFTER UPDATE ON ${table}
      FOR EACH ROW
      EXECUTE PROCEDURE "${method}"(${args.join(', ')});
    `;
    await db.execute(sql);
  }
}