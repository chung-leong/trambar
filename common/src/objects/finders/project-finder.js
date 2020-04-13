const schema = 'global';
const table = 'project';
const emptyArray = [];

/**
 * Find project by ID
 *
 * @param  {Database} db
 * @param  {number} id
 *
 * @return {Project}
 */
async function findProject(db, id) {
  return db.findOne({
    schema,
    table,
    criteria: { id },
    required: true
  });
}

/**
 * Find project by ID
 *
 * @param  {Database} db
 * @param  {string} name
 *
 * @return {Project}
 */
async function findProjectByName(db, name) {
  return db.findOne({
    schema,
    table,
    criteria: { name },
    required: true
  });
}

/**
 * Find all projects
 *
 * @param  {Database} db
 * @param  {number|undefined} minimum
 *
 * @return {Project[]}
 */
async function findAllProjects(db, minimum) {
  return db.find({
    schema,
    table,
    criteria: {},
    minimum
  });
}

/**
 * Find current project, as determined by database object's preset schema
 *
 * @param  {Database} db
 *
 * @return {Project}
 */
async function findCurrentProject(db) {
  return db.findOne({
    schema,
    table,
    criteria: { name: db.context.schema + '' },
    required: true
  });
}

/**
 * Find projects that aren't deleted or archived
 *
 * @param  {Database} db
 * @param  {number|undefined} minimum
 *
 * @return {Project[]}
 */
async function findActiveProjects(db, minimum) {
  return db.find({
    schema,
    table,
    criteria: {
      archived: false,
      deleted: false,
    },
    minimum
  });
}

/**
 * Find active projects that have given users as members
 *
 * @param  {Database} db
 * @param  {User[]} users
 * @param  {number|undefined} minimum
 *
 * @return {Project[]}
 */
async function findProjectsWithMembers(db, users, minimum) {
  const ids = users.map(usr => usr.id);
  if (ids.length === 0) {
    return emptyArray;
  }
  ids.sort();
  return db.find({
    schema,
    table,
    criteria: {
      user_ids: ids,
      archived: false,
      deleted: false,
    },
    minimum
  });
}

export {
  findProject,
  findProjectByName,
  findAllProjects,
  findCurrentProject,
  findActiveProjects,
  findProjectsWithMembers,
};
