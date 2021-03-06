"use strict"; // catch errors easier

const github = require("./github.js"); // config file
const cfg = require("./config.js"); // config file
const addLabels = require("./issues/addLabels.js"); // add labels
const claimIssue = require("./issues/claimIssue.js"); // claim issue
const abandonIssue = require("./issues/abandonIssue.js"); // abandon issue
const removeLabels = require("./issues/removeLabels.js"); // remove labels
const issueAreaLabeled = require("./issues/issueAreaLabeled.js"); // issue labeled with area label
const checkPullRequestComment = require("./issues/checkPullRequestComment.js"); // check if comment belongs to PR
const joinLabelTeam = require("./issues/joinLabelTeam.js"); // join label team

module.exports = exports = function(payload) {
  // get necessary information from request body
  const action = payload.action;
  const issueLabelArray = payload.issue.labels;
  const issueNumber = payload.issue.number; // number of issue
  const issueCreator = payload.issue.user.login;
  const repoName = payload.repository.name; // issue repository
  const repoOwner = payload.repository.owner.login; // repository owner
  let commenter, body, addedLabel; // initialize variables for commenter, issue (comment) body, and added label
  if (action === "opened") { // if issue was opened
    commenter = payload.issue.user.login; // issue creator's username
    body = payload.issue.body; // contents of issue body
  } else if (action === "created") { // if issue comment was created
    commenter = payload.comment.user.login; // commenter's username
    body = payload.comment.body; // contents of issue comment
  } else if (action === "labeled" && cfg.areaLabels) {
    addedLabel = payload.label.name;
    issueAreaLabeled(addedLabel, issueNumber, repoName, repoOwner, issueLabelArray); // check if issue labeled with area label
    return;
  } else if (action === "closed") {
    const hasInProgressLabel = issueLabelArray.find(issueLabel => issueLabel.name === cfg.inProgressLabel);
    if (hasInProgressLabel) github.issues.removeLabel({owner: repoOwner, repo: repoName, number: issueNumber, name: cfg.inProgressLabel});
    return;
  } else return;
  if (commenter === cfg.username) return;
  if (!body) return; // if body is empty
  const commands = body.match(new RegExp("@" + cfg.username + "\\s(\\w*)", "g"));
  if (!commands) return; // if there is no command
  if (body.match(/#([0-9]+)/) && cfg.areaLabels) checkPullRequestComment(body, issueNumber, repoName, repoOwner); // check if comment is from PR
  commands.forEach((command) => {
    if (body.includes(`\`${command}\``) || body.includes(`\`\`\`\r\n${command}\r\n\`\`\``)) return;
    const commandName = command.split(" ")[1];
    if (cfg.claimCommands.includes(commandName)) claimIssue(commenter, issueNumber, repoName, repoOwner); // check body content for "@zulipbot claim"
    else if (cfg.abandonCommands.includes(commandName)) abandonIssue(commenter, issueNumber, repoName, repoOwner); // check body content for "@zulipbot abandon" or "@zulipbot claim"
    else if (cfg.labelCommands.includes(commandName)) {
      if (cfg.selfLabelingOnly && commenter !== issueCreator) return;
      const splitBody = body.split(`@${cfg.username}`).filter((splitString) => {
        return splitString.includes(` ${commandName} "`);
      }).join(" ");
      addLabels(splitBody, issueNumber, repoName, repoOwner, issueLabelArray); // check body content for "@zulipbot label" and ensure commenter opened the issue
    } else if (cfg.removeCommands.includes(commandName)) {
      if (cfg.selfLabelingOnly && commenter !== issueCreator) return;
      const splitBody = body.split(`@${cfg.username}`).filter((splitString) => {
        return splitString.includes(` ${commandName} "`);
      }).join(" ");
      removeLabels(splitBody, issueNumber, repoName, repoOwner, issueLabelArray); // check body content for "@zulipbot remove" and ensure commenter opened the issue
    } else if (cfg.joinCommands.includes(commandName) && cfg.areaLabels) {
      const splitBody = body.split(`@${cfg.username}`).filter((splitString) => {
        return splitString.includes(` ${commandName} "`);
      }).join(" ");
      joinLabelTeam(splitBody, commenter, repoOwner, repoName, issueNumber); // check body content for "@zulipbot join"
    }
  });
};
