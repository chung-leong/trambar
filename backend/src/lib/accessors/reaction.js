var _ = require('lodash');
var Promise = require('bluebird');

var Data = require('accessors/data');

module.exports = _.create(Data, {
    schema: 'project',
    table: 'reaction',
    columns: {
        id: Number,
        gn: Number,
        deleted: Boolean,
        ctime: String,
        mtime: String,
        details: Object,
        type: String,
        story_id: Number,
        user_id: Number,
        target_user_id: Number,
        public: Boolean,
    },
    criteria: {
        id: Number,
        deleted: Boolean,
        type: String,
        story_id: Number,
        user_id: Number,
        target_user_id: Number,
        public: Boolean,
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
                project_id int NOT NULL,
                story_id int NOT NULL,
                user_id int,
                target_user_id int,
                public boolean NOT NULL,
                PRIMARY KEY (id)
            );
        `;
        return db.execute(sql);
    },
});
