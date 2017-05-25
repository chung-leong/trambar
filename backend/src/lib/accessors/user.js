var _ = require('lodash');
var Promise = require('bluebird');

var Data = require('accessors/data');

module.exports = _.create(Data, {
    schema: 'global',
    table: 'user',
    columns: {
        id: Number,
        gn: Number,
        ctime: String,
        mtime: String,
        details: Object,
        type: String,
        name: String,
        project_ids: Array(Number),
    },
    criteria: {
        id: Number,
        type: String,
        name: String,
        project_ids: Array(Number),
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
                type varchar(32),
                name varchar(256),
                project_ids int[] NOT NULL DEFAULT '{}'::int[],
                PRIMARY KEY (id)
            );
        `;
        return db.execute(sql);
    },
});
