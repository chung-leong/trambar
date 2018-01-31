var _ = require('lodash');
var Promise = require('bluebird');
var React = require('react'), PropTypes = React.PropTypes;
var LocalSearch = require('data/local-search');

// mixins
var UpdateCheck = require('mixins/update-check');

// widgets
var Diagnostics = require('widgets/diagnostics');
var DiagnosticsSection = require('widgets/diagnostics-section');

var openDatabase = window.openDatabase;
if (window.sqlitePlugin) {
    openDatabase = window.sqlitePlugin.openDatabase;
}

module.exports = React.createClass({
    displayName: 'SQLiteCache',
    mixins: [ UpdateCheck ],
    propTypes: {
        databaseName: PropTypes.string.isRequired,
    },

    statics: {
        /**
         * Return true if SQLite is available
         *
         * @return {Boolean}
         */
        isAvailable: function() {
            return !!openDatabase;
        },
    },

    /**
     * Return initial state of component
     *
     * @return {Object}
     */
    getInitialState: function() {
        return {
            recordCounts: {},
            writeCount: 0,
            readCount: 0,
        };
    },

    /**
     * Look for objects in cache
     *
     * Query object contains the name of the origin server, schema, and table
     *
     * @param  {Object} query
     *
     * @return {Promise<Array<Object>>}
     */
    find: function(query) {
        var server = query.server || '';
        var schema = query.schema;
        var table = query.table;
        var cacheTableName = (schema === 'local') ? 'local_data' : 'remote_data';
        var criteria = query.criteria;
        var sql, params
        if (schema === 'local') {
            sql = `
                SELECT json FROM ${cacheTableName}
                WHERE table_name = ?
            `;
            params = [ table ];
            if (criteria && criteria.key !== undefined && _.size(criteria) === 1) {
                // look up by key
                sql += ` AND key = ?`;
                params.push(criteria.key);
                criteria = null;
            }
            sql += ' ORDER BY key';
        } else {
            sql = `
                SELECT json FROM ${cacheTableName}
                WHERE server_name = ?
                AND schema_name = ?
                AND table_name = ?
            `;
            params = [ server, schema, table ];
            if (criteria && criteria.id !== undefined && _.size(criteria) === 1) {
                // look up by id
                var ids = criteria.id;
                if (ids instanceof Array) {
                    sql += ` AND id IN (${_.fill(_.clone(ids), '?').join(',')})`;
                    params.push.apply(params, ids);
                } else {
                    sql += ` AND id = ?`;
                    params.push(ids);
                }
                criteria = null;
            }
            sql += ' ORDER BY id';
        }
        return this.query(sql, params).then((rows) => {
            var objects = [];
            for (var i = 0; i < rows.length; i++) {
                var object = decodeJSON(rows[i].json);
                if (object) {
                    if (!criteria || LocalSearch.match(table, object, criteria)) {
                        objects.push(object);
                    }
                }
            }
            var readCount = this.state.readCount;
            readCount += objects.length;
            this.setState({ readCount });
            return objects;
        });
    },

    /**
     * Save objects originating from specified location into cache
     *
     * @param  {Object} location
     * @param  {Array<Object>} objects
     *
     * @return {Promise<Array<Object>>}
     */
    save: function(location, objects) {
        var server = location.server || '';
        var schema = location.schema;
        var table = location.table;
        var statements = [], paramSets = [];
        var cacheTableName = (schema === 'local') ? 'local_data' : 'remote_data';
        _.each(objects, (object) => {
            var json = JSON.stringify(object);
            if (schema === 'local') {
                statements.push(`
                    INSERT OR REPLACE INTO ${cacheTableName}
                    (table_name, key, json)
                    VALUES (?, ?, ?)
                `);
                paramSets.push([ table, object.key, json ]);
            } else {
                var rtime = (new Date(object.rtime)).getTime();
                statements.push(`
                    INSERT OR REPLACE INTO ${cacheTableName}
                    (server_name, schema_name, table_name, id, json, rtime)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);
                paramSets.push([ server, schema, table, object.id, json, rtime ]);
            }
        });
        return this.execute(statements, paramSets).then(() => {
            var writeCount = this.state.writeCount;
            writeCount += objects.length;
            this.setState({ writeCount });
            this.updateRecordCount(cacheTableName, 500);
            return objects;
        });
    },

    /**
     * Remove objects from cache that originated from specified location
     *
     * @param  {Object} location
     * @param  {Array<Object>} objects
     *
     * @return {Promise<Array<Object>>}
     */
    remove: function(location, objects) {
        var server = location.server || '';
        var schema = location.schema;
        var table = location.table;
        var cacheTableName = (schema === 'local') ? 'local_data' : 'remote_data';
        return Promise.mapSeries(objects, (object) => {
            var sql, params;
            if (schema === 'local') {
                sql = `
                    DELETE FROM ${cacheTableName}
                    WHERE table_name = ? AND key = ?
                `;
                params = [ table, object.key ];
            } else {
                sql = `
                    DELETE FROM ${cacheTableName}
                    WHERE server_name = ?
                    AND schema_name = ?
                    AND table_name = ?
                    AND id = ?
                `;
                params = [ server, schema, table, object.id ];
            }
            return this.execute(sql, params);
        }).then((objects) => {
            this.updateRecordCount(cacheTableName, 500);
            return objects;
        });
    },

    /**
     * Remove objects by one of three criteria:
     *
     * server - remove all objects from specified server
     * count - remove certain number of objects, starting from those least recent
     * before - remove objects with retrieval time (rtime) earlier than given value
     *
     * Return value is the number of objects removed
     *
     * @param  {Object} criteria
     *
     * @return {Promise<Number>}
     */
    clean: function(criteria) {
        var sql, params;
        if (criteria.server !== undefined) {
            sql = `
                DELETE FROM remote_data
                WHERE server_name = ?
            `;
            params = [ criteria.server ];
        } else if (criteria.count !== undefined) {
            sql = `
                DELETE FROM remote_data
                WHERE rowid IN (
                    SELECT rowid FROM remote_data ORDER BY rtime LIMIT ?
                )
            `;
            params = [ criteria.count ];
        } else if (criteria.before !== undefined) {
            var rtime = (new Date(criteria.before)).getTime();
            sql = `
                DELETE FROM remote_data
                WHERE rtime < ?
            `;
            params = [ rtime ];
        }
        return this.execute(sql, params).then((count) => {
            if (count > 0) {
                this.updateRecordCount('remote_data');
            }
        });
    },

    /**
     * Run a query and return the resulting rows
     *
     * @param  {String} sql
     * @param  {Array<*>} params
     *
     * @return {Promise<Array<Object>>}
     */
    query: function(sql, params) {
        return this.open().then((db) => {
            return new Promise((resolve, reject) => {
                // annoyingly, SQLError isn't a subclass of Error
                var rejectT = (err) => { reject(new Error(err.message)) };
                db.transaction((tx) => {
                    tx.executeSql(sql, params, (tx, rs) => {
                        var rows = [];
                        for (var i = 0; i < rs.rows.length; i++) {
                            rows.push(rs.rows.item(i));
                        }
                        resolve(rows);
                    });
                }, rejectT);
            });
        });
    },

    /**
     * Execute a SQL statement
     *
     * @param  {String} sql
     * @param  {Array<*>} params
     *
     * @return {Promise}
     */
    execute: function(sql, params) {
        return this.open().then((db) => {
            return new Promise((resolve, reject) => {
                var rejectT = (err) => { reject(new Error(err.message)) };
                var resolveT = () => { resolve(affected) };
                var affected = 0;
                var callback = (tx, rs) => { affected += rs.rowsAffected };
                db.transaction((tx) => {
                    if (sql instanceof Array) {
                        for (var i = 0; i < sql.length; i++) {
                            tx.executeSql(sql[i], params[i], callback);
                        }
                    } else {
                        tx.executeSql(sql, params, callback);
                    }
                }, rejectT, resolveT);
            });
        });
    },

    /**
     * Open database, creating schema if it doesn't exist already
     *
     * @return {Promise<Database>}
     */
    open: function() {
        if (!this.databasePromise) {
            this.databasePromise = Promise.try(() => {
                var db = openDatabase(this.props.databaseName, '1.0', '', 50 * 1048576);
                var sql = [
                    `
                        CREATE TABLE IF NOT EXISTS remote_data (
                            server_name text,
                            schema_name text,
                            table_name text,
                            id int,
                            json text,
                            rtime datetime
                        )
                    `,
                    `
                        CREATE UNIQUE INDEX IF NOT EXISTS remote_data_idx_id
                        ON remote_data (
                            server_name,
                            schema_name,
                            table_name,
                            id
                        )
                    `,
                    `
                        CREATE INDEX IF NOT EXISTS remote_data_idx_location
                        ON remote_data (
                            server_name,
                            schema_name,
                            table_name
                        )
                    `,
                    `
                        CREATE INDEX IF NOT EXISTS remote_data_idx_rtime
                        ON remote_data (
                            rtime
                        )
                    `,
                    `
                        CREATE TABLE IF NOT EXISTS local_data (
                            table_name text,
                            key text,
                            json text
                        )
                    `,
                    `
                        CREATE UNIQUE INDEX IF NOT EXISTS local_data_idx_key
                        ON local_data (
                            table_name,
                            key
                        )
                    `,
                ];
                return new Promise((resolve, reject) => {
                    var rejectS = (err) => { reject(new Error(err.message)) };
                    db.transaction((tx) => {
                        _.each(sql, (sql) => {
                            tx.executeSql(sql);
                        });
                    }, rejectS, resolve)
                }).return(db);
            });
        }
        return this.databasePromise;
    },

    /**
     * Count the number of rows in the table (on a time delay)
     *
     * @param  {String} tableName
     * @param  {Number} delay
     */
    updateRecordCount: function(tableName, delay) {
        var timeoutPath = `updateRecordCountTimeouts.${tableName}`;
        var timeout = _.get(this, timeoutPath);
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            var sql = `SELECT COUNT(*) as count FROM ${tableName}`;
            this.query(sql).then((rows) => {
                var recordCounts = _.clone(this.state.recordCounts);
                recordCounts[tableName] = rows[0].count;
                this.setState({ recordCounts });
            }).catch((err) => {
            });
            _.set(this, timeoutPath, 0);
        }, delay || 0);
        _.set(this, timeoutPath, timeout);
    },

    /**
     * Count the number of rows in the object stores on mount
     */
    componentDidMount: function() {
        this.updateRecordCount('remote_data');
        this.updateRecordCount('local_data');
    },

    /**
     * Render diagnostics
     *
     * @return {ReactElement}
     */
    render: function() {
        var db = this.state.database;
        var localRowCount = _.get(this.state.recordCounts, 'local_data');
        var remoteRowCount = _.get(this.state.recordCounts, 'remote_data');
        return (
            <Diagnostics type="sqlite-cache">
                <DiagnosticsSection label="Database details">
                    <div>Name: {this.props.databaseName}</div>
                </DiagnosticsSection>
                <DiagnosticsSection label="Usage">
                    <div>Local objects: {localRowCount}</div>
                    <div>Remote objects: {remoteRowCount}</div>
                    <div>Objects read: {this.state.readCount}</div>
                    <div>Objects written: {this.state.writeCount}</div>
                </DiagnosticsSection>
            </Diagnostics>
        );
    },
});

function decodeJSON(s) {
    try {
        return JSON.parse(s);
    } catch(err) {
        return null;
    }
}
