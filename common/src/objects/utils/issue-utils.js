import { findLinkByRelative } from './external-data-utils.js';

/**
 * Extract information concerning an issue issue from a story and
 * arrange it in a more intuitive fashion
 *
 * @param  {Story} story
 * @param  {Repo[]} repos
 *
 * @return {Object|null}
 */
function extractIssueDetails(story, repos) {
  if (!story || !repos) {
    return null;
  }
  // find the repo in whose tracker the issue resides
  let issueRepo, issueLink;
  for (let repo of repos) {
    let link = findLinkByRelative(story, repo, 'project');
    if (link && link.issue) {
      issueRepo = repo;
      issueLink = link;
    }
  }
  if (!issueRepo) {
    // either the repo has gone missing or it's not loaded yet
    return null;
  }
  return {
    id: issueLink.issue.id,
    number: issueLink.issue.number,
    title: story.details.title || '',
    labels: story.details.labels || [],
    repo_id: issueRepo.id,
  };
}

export {
  extractIssueDetails,
};
