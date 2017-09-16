var _ = require('lodash');
var Promise = require('bluebird');
var Data = require('accessors/data');
var Task = require('accessors/task');

module.exports = _.create(Data, {
    schema: 'global',
    table: 'project',
    columns: {
        id: Number,
        gn: Number,
        deleted: Boolean,
        ctime: String,
        mtime: String,
        details: Object,
        name: String,
        repo_ids: Array(Number),
        user_ids: Array(Number),
        settings: Object,
    },
    criteria: {
        id: Number,
        deleted: Boolean,
        name: String,
        repo_ids: Array(Number),
        user_ids: Array(Number),
    },

    /**
     * Create table in schema
     *
     * @param  {Database} db
     * @param  {String} schema
     *
     * @return {Promise<Result>}
     */
    create: function(db, schema) {
        var table = this.getTableName(schema);
        var sql = `
            CREATE TABLE ${table} (
                id serial,
                gn int NOT NULL DEFAULT 1,
                deleted boolean NOT NULL DEFAULT false,
                ctime timestamp NOT NULL DEFAULT NOW(),
                mtime timestamp NOT NULL DEFAULT NOW(),
                details jsonb NOT NULL DEFAULT '{}',
                name varchar(64) NOT NULL DEFAULT '',
                repo_ids int[] NOT NULL DEFAULT '{}'::int[],
                user_ids int[] NOT NULL DEFAULT '{}'::int[],
                settings jsonb NOT NULL DEFAULT '{}',
                PRIMARY KEY (id)
            );
            CREATE INDEX ON ${table} USING gin(("payloadIds"(details))) WHERE "payloadIds"(details) IS NOT NULL;
        `;
        return db.execute(sql);
    },

    /**
     * Grant privileges to table to appropriate Postgres users
     *
     * @param  {Database} db
     * @param  {String} schema
     *
     * @return {Promise<Boolean>}
     */
    grant: function(db, schema) {
        var table = this.getTableName(schema);
        var sql = `
            GRANT SELECT ON ${table} TO auth_role;
            GRANT INSERT, SELECT, UPDATE, DELETE ON ${table} TO admin_role;
            GRANT SELECT, UPDATE ON ${table} TO client_role;
        `;
        return db.execute(sql).return(true);
    },

    /**
     * Attach triggers to this table, also add trigger on task so details
     * are updated when tasks complete
     *
     * @param  {Database} db
     * @param  {String} schema
     *
     * @return {Promise<Boolean>}
     */
    watch: function(db, schema) {
        return Data.watch.call(this, db, schema).then(() => {
            return Task.createUpdateTrigger(db, schema, this.table, 'updateResource');
        });
    },

    /**
     * Add conditions to SQL query based on criteria object
     *
     * @param  {Object} criteria
     * @param  {Object} query
     */
    apply: function(criteria, query) {
        Data.apply.call(this, criteria, query);

        if (query.columns !== '*') {
            // filter() needs these columns to work
            query.columns += ', deleted, user_ids, settings';
        }
    },

    /**
     * Filter out rows that user doesn't have access to
     *
     * @param  {Database} db
     * @param  {Schema} schema
     * @param  {Array<Object>} rows
     * @param  {Object} credentials
     *
     * @return {Promise<Array>}
     */
    filter: function(db, schema, rows, credentials) {
        rows = _.filter(rows, (row) => {
            return this.checkAccess(row, credentials.user, 'know');
        });
        return Promise.resolve(rows);
    },

    /**
     * Export database row to client-side code, omitting sensitive or
     * unnecessary information
     *
     * @param  {Database} db
     * @param  {Schema} schema
     * @param  {Array<Object>} rows
     * @param  {Object} credentials
     * @param  {Object} options
     *
     * @return {Promise<Object>}
     */
    export: function(db, schema, rows, credentials, options) {
        return Data.export.call(this, db, schema, rows, credentials, options).then((objects) => {
            _.each(objects, (object, index) => {
                var row = rows[index];
                object.name = row.name;
                object.repo_ids = row.repo_ids;
                object.user_ids = row.user_ids;
                if (credentials.unrestricted) {
                    object.settings = row.settings;
                } else {
                    object.settings = _.pick(row.settings, 'access_control');
                }
            });
            return objects;
        });
    },

    /**
     * Create associations between newly created or modified rows with
     * rows in other tables
     *
     * @param  {Database} db
     * @param  {Schema} schema
     * @param  {Array<Object>} objects
     * @param  {Array<Object>} originals
     * @param  {Array<Object>} rows
     * @param  {Object} credentials
     *
     * @return {Promise<Array>}
     */
    associate: function(db, schema, objects, originals, rows, credentials) {
        // remove ids from requested_project_ids of users who've just joined
        // first, obtain ids of projects that new members are added to
        var newUserMemberships = {};
        _.each(objects, (object, index) => {
            var original = originals[index];
            var row = rows[index];
            if (object.user_ids) {
                var newUserIds = (original)
                               ? _.difference(row.user_ids, original.user_ids)
                               : row.user_ids;
                _.each(newUserIds, (userId) => {
                    var ids = newUserMemberships[userId];
                    if (ids) {
                        ids.push(row.id);
                    } else {
                        newUserMemberships[userId] = [ row.id ];
                    }
                });
            }
        });
        if (_.isEmpty(newUserMemberships)) {
            return Promise.resolve();
        }
        // load the users and update requested_project_ids column
        var User = require('accessors/user');
        var criteria = {
            id: _.map(_.keys(newUserMemberships), parseInt)
        };
        return User.find(db, schema, criteria, 'id, requested_project_ids').then((users) => {
            _.each(users, (user) => {
                user.requested_project_ids = _.difference(user.requested_project_ids, newUserMemberships[user.id]);
                if (_.isEmpty(user.requested_project_ids)) {
                    user.requested_project_ids = null;
                }
            });
            return User.update(db, schema, users);
        }).return();
    },

    /**
     * Return false if the user has no access to project
     *
     * Need these columns: deleted, user_ids, settings
     *
     * @param  {Project} project
     * @param  {User} user
     * @param  {String} string
     *
     * @return {Boolean}
     */
    checkAccess: function(project, user, type) {
        if (!project || project.deleted) {
            return false;
        }
        // project member and admins have full access
        if (_.includes(project.user_ids, user.id)) {
            return true;
        }
        if (user.type === 'admin') {
            return true;
        }

        // see if read-only access should be granted
        var ms = project.settings.membership;
        if (!ms) {
            return false;
        }
        if (access === 'know' || access === 'read') {
            // see if people can know about the project's existence
            if (user.type === 'member') {
                if (!ms.allow_request_from_team_members) {
                    return false;
                }
            } else if (user.type === 'guest') {
                if (user.approved) {
                    if (!ms.allow_request_from_approved_guests) {
                        return false;
                    }
                } else {
                    if (!ms.allow_request_from_unapproved_guests) {
                        return false;
                    }
                }
            } else {
                return false;
            }
            if (access == 'know') {
                return true;
            }
        }
        var ac = project.settings.access_control;
        if (!ac) {
            return false;
        }
        if (access === 'read') {
            if (!_.includes(user.requested_project_ids, user.id)) {
                // only users who wants to join the project can have
                // read-only access
                return false;
            }
            if (user.type === 'member') {
                if (!ac.grant_team_members_read_only) {
                    return false;
                }
            } else if(user.type === 'guest') {
                if (user.approved) {
                    if (!ac.grant_approved_users_read_only) {
                        return false;
                    }
                } else {
                    if (!ac.grant_unapproved_users_read_only) {
                        return false;
                    }
                }
            } else {
                return false;
            }
            return true;
        }
        return false;
    }
});
