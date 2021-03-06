/**
 * Find pictures in collection for given purpose
 *
 * @param  {Database} db
 * @param  {String} purpose
 * @param  {Number|undefined} minimum
 *
 * @return {Promise<Array<Picture>>}
 */
async function findPictures(db, purpose, minimum) {
    return db.find({
        table: 'picture',
        criteria: {
            purpose: purpose,
            deleted: false,
        },
        minimum
    });
}

export {
    findPictures,
};
