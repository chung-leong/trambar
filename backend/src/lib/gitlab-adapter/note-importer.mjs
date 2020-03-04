import _ from 'lodash';
import Moment from 'moment';
import Crypto from 'crypto';
import { TaskLog } from '../task-log.mjs';
import { getDefaultLanguageCode } from '../localization.mjs';
import * as ExternalDataUtils from '../external-data-utils.mjs';
import { HTTPError } from '../errors.mjs';

import * as Transport from './transport.mjs';
import * as UserImporter from './user-importer.mjs';

import { Commit } from '../accessors/commit.mjs';
import { Story } from '../accessors/story.mjs';
import { Reaction } from '../accessors/reaction.mjs';

/**
 * @param  {Database} db
 * @param  {System} system
 * @param  {Server} server
 * @param  {Repo} repo
 * @param  {Project} project
 * @param  {User} author
 * @param  {Object} glEvent
 * @param  {Object} glHookEvent
 *
 * @return {Promise}
 */
async function processEvent(db, system, server, repo, project, author, glEvent, glHookEvent) {
  const noteType = _.toLower(glEvent.note.noteable_type);
  if (noteType === 'issue') {
    await processIssueNoteEvent(db, system, server, repo, project, author, glEvent);
  } else if (noteType === 'commit') {
    await processCommitNoteEvent(db, system, server, repo, project, author, glEvent, glHookEvent);
  } else if (noteType === 'mergerequest' || noteType === 'merge_request') {
    await processMergeRequestNoteEvent(db, system, server, repo, project, author, glEvent);
  }
}

/**
 * Add note to an issue story
 *
 * @param  {Database} db
 * @param  {System} system
 * @param  {Server} server
 * @param  {Repo} repo
 * @param  {Project} project
 * @param  {User} author
 * @param  {Object} glEvent
 *
 * @return {Promise}
 */
async function processIssueNoteEvent(db, system, server, repo, project, author, glEvent) {
  const schema = project.name;
  const criteria = {
    external_object: ExternalDataUtils.extendLink(server, repo, {
      issue: { id: glEvent.note.noteable_id }
    })
  };
  const story = await Story.findOne(db, schema, criteria, '*');
  if (!story) {
    return;
  }
  const reactionNew = copyEventProperties(null, system, server, story, author, glEvent);
  await Reaction.insertOne(db, schema, reactionNew);
}

/**
 * Add note to an merge-request story
 *
 * @param  {Database} db
 * @param  {System} system
 * @param  {Server} server
 * @param  {Repo} repo
 * @param  {Project} project
 * @param  {User} author
 * @param  {Object} glEvent
 *
 * @return {Promise}
 */
async function processMergeRequestNoteEvent(db, system, server, repo, project, author, glEvent) {
  const schema = project.name;
  const criteria = {
    external_object: ExternalDataUtils.extendLink(server, repo, {
      merge_request: { id: glEvent.note.noteable_id }
    })
  };
  const story = await Story.findOne(db, schema, criteria, '*');
  if (!story) {
    return;
  }
  const reactionNew = copyEventProperties(null, system, server, story, author, glEvent);
  await Reaction.insertOne(db, schema, reactionNew);
}

/**
 * Add note to a push story
 *
 * @param  {Database} db
 * @param  {System} system
 * @param  {Server} server
 * @param  {Repo} repo
 * @param  {Project} project
 * @param  {Object} glEvent
 * @param  {Object} glHookEvent
 *
 * @return {Promise}
 */
async function processCommitNoteEvent(db, system, server, repo, project, author, glEvent, glHookEvent) {
  // need to find the commit id first, since Gitlab doesn't include it
  // in the activity log entry
  const commitID = await findCommitID(db, server, repo, glEvent, glHookEvent);
  if (!commitID) {
    return;
  }
  const schema = project.name;
  const criteria = {
    external_object: ExternalDataUtils.extendLink(server, repo, {
      commit: { id: commitID }
    })
  };
  const story = await Story.findOne(db, schema, criteria, '*');
  if (!story) {
    return;
  }
  const reactionNew = copyEventProperties(null, system, server, story, author, glEvent);
  // link to a particular commit (whereas the story could be linked to multiple)
  const link = ExternalDataUtils.findLink(reactionNew, server);
  if (link.commit.ids instanceof Array) {
    link.commit = { id: commitID };
  }
  await Reaction.insertOne(db, schema, reactionNew);
}

/**
 * Look for the id of the commit that the note is on
 *
 * @param  {Database} db
 * @param  {Server} server
 * @param  {Repo} repo
 * @param  {Object} glEvent
 * @param  {Object} glHookEvent
 *
 * @return {Promise<String|undefined>}
 */
async function findCommitID(db, server, repo, glEvent, glHookEvent) {
  if (glHookEvent) {
    // the object sent through the hook has the commit id
    // we can use that when we're responding to a call from Gitlab
    if (glHookEvent.object_attributes.id === glEvent.note.id) {
      const commitID = glHookEvent.object_attributes.commit_id;
      return commitID;
    }
  }

  const criteria = {
    title_hash: hash(glEvent.target_title),
    external_object: ExternalDataUtils.findLink(repo, server),
  };
  const commits = await Commit.find(db, 'global', criteria, '*');
  for (let commit of commits) {
    const commitLink = ExternalDataUtils.findLink(commit, server);
    const commitID = commitLink.commit.id;
    const projectID = commitLink.project.id;
    const glNotes = await fetchCommitNotes(server, projectID, commitID);
    const found = _.some(glNotes, (glNote) => {
      if (glNote.note === glEvent.note.body) {
        return true;
      }
    });
    if (found) {
      return commitID;
    }
  }
}

/**
 * Copy certain properties of event into reaction
 *
 * @param  {Reaction|null} reaction
 * @param  {System} system
 * @param  {Server} server
 * @param  {Story} story
 * @param  {User} author
 * @param  {Object} glNote
 * @param  {Object} link
 *
 * @return {Reaction}
 */
function copyEventProperties(reaction, system, server, story, author, glNote) {
  const defLangCode = getDefaultLanguageCode(system);
  const reactionChanges = _.cloneDeep(reaction) || {};
  ExternalDataUtils.inheritLink(reactionChanges, server, story, {
    note: { id: _.get(glNote, 'note.id') }
  });
  ExternalDataUtils.importProperty(reactionChanges, server, 'type', {
    value: 'note',
    overwrite: 'always',
  });
  ExternalDataUtils.importProperty(reactionChanges, server, 'story_id', {
    value: story.id,
    overwrite: 'always',
  });
  ExternalDataUtils.importProperty(reactionChanges, server, 'user_id', {
    value: author.id,
    overwrite: 'always',
  });
  ExternalDataUtils.importProperty(reactionChanges, server, 'public', {
    value: true,
    overwrite: 'always',
  });
  ExternalDataUtils.importProperty(reactionChanges, server, 'published', {
    value: true,
    overwrite: 'always',
  });
  ExternalDataUtils.importProperty(reactionChanges, server, 'ptime', {
    value: Moment(glNote.created_at).toISOString(),
    overwrite: 'always',
  });
  if (_.isEqual(reactionChanges, reaction)) {
    return null;
  }
  reactionChanges.itime = new String('NOW()');
  return reactionChanges;
}

/**
 * Retrieve merge request notes from Gitlab server
 *
 * @param  {Server} server
 * @param  {Number} glProjectID
 * @param  {String} glCommitID
 * @param  {String} glObjectType
 *
 * @return {Promise<Array<Object>>}
 */
async function fetchCommitNotes(server, glProjectID, glCommitID) {
  const url = `/projects/${glProjectID}/repository/commits/${glCommitID}/comments`;
  return Transport.fetchAll(server, url);
}

/**
 * Generate MD5 hash of text
 *
 * @param  {String} text
 *
 * @return {String}
 */
function hash(text) {
  const hash = Crypto.createHash('md5').update(text);
  return hash.digest("hex");
}

export {
  processEvent,
};