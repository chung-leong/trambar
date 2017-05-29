var _ = require('lodash');
var Promise = require('bluebird');

module.exports = {
    schema: 'project',
    table: 'listing_retrieval',
    columns: {
        id: Number,
        type: String,
        target_user_id: Number,
        last_retrieval_time: String,
    },
    criteria: {
        id: Number,
        type: String,
        target_user_id: Number,
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
                type varchar(32) NOT NULL,
                target_user_id int NOT NULL,
                last_retrieval_time timestamp,
                PRIMARY KEY (id)
            );
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
        var table = `"global"."${this.table}"`;
        var privileges = 'INSERT, SELECT, UPDATE, DELETE';
        var sql = `
            GRANT ${privileges} ON ${table} TO internal_role;
            GRANT ${privileges} ON ${table} TO webfacing_role;
        `;
        return db.execute(sql).return(true);
    },

    /**
     * Attach a trigger to the table that increment the gn (generation number)
     * when a row is updated. Also add triggers that send notification messages.
     *
     * @param  {Database} db
     * @param  {String} schema
     *
     * @return {Promise<Boolean>}
     */
    watch: function(db, schema) {
        return Promise.resolve(false);
    },

    findOne: function(db, schema, criteria, columns) {
        var table = `"global"."${this.table}"`;
        if (criteria.type && criteria.target_user_id) {
            var sql = `
                SELECT ${columns}
                FROM ${table}
                WHERE type = $1
                AND target_user_id = $2
            `;
            var parameters = [ criteria.type, criteria.target_user_id ];
            return db.query(sql, parameters).get(0).then((row) => {
                return row || null;
            });
        } else {
            return Promise.resolve(null);
        }
    },
};
