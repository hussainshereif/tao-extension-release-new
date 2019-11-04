/**
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; under version 2
 * of the License (non-upgradable).
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * Copyright (c) 2019 Open Assessment Technologies SA;
 */

/**
 * This module contains methods to release a TAO extension.
 *
 * @author Anton Tsymuk <anton@taotesting.com>
 */

const inquirer = require('inquirer');
const opn = require('opn');
const path = require('path');
const compareVersions = require('compare-versions');

const config = require('./config.js')();
const gitClientFactory = require('./git.js');
const github = require('./github.js');
const log = require('./log.js');
const taoInstanceFactory = require('./taoInstance.js');

/**
 * Get the taoExtensionRelease
 *
 * @param {Object} params
 * @param {String} [params.baseBranch] - branch to release from
 * @param {String} [params.branchPrefix] - releasing branch prefix
 * @param {String} [params.origin] - git repository origin
 * @param {String} [params.releaseBranch] - branch to release to
 * @param {String} [params.wwwUser] - name of the www user
 * @param {String} [params.pathToTao] - path to the instance root
 * @param {String} [params.extensionToRelease] - name of the extension
 * @param {String} [params.versionToRelease] - version in xx.x.x format
 * @param {Boolean} [params.updateTranslations] - should translations be included?
 * @param {String} [params.releaseComment] - the release author's comment
 * @return {Object} - instance of taoExtensionRelease
 */
module.exports = function taoExtensionReleaseFactory(params = {}) {
    const { baseBranch, branchPrefix, origin, releaseBranch, wwwUser,
        extensionToRelease, versionToRelease, updateTranslations } = params;
    let { pathToTao, releaseComment } = params;

    let data = {};
    let gitClient;
    let githubClient;
    let taoInstance;

    return {

        /**
         * Check out the predefined releasing branch
         */
        async checkoutReleasingBranch() {
            const allBranches = await gitClient.getLocalBranches();

            if (allBranches.includes(data.releasingBranch)) {
                // Branch exists locally
                await gitClient.checkout(data.releasingBranch);
            }
            else {
                // Branch only exists remotely
                await gitClient.checkoutNonLocal(data.releasingBranch, origin);
            }
        },

        /**
         * Compile and publish extension assets
         */
        async compileAssets() {
            log.doing('Bundling');
            log.info('Asset build started, this may take a while');

            try {
                await taoInstance.buildAssets(data.extension.name, false);

                const changes = await gitClient.commitAndPush(data.releasingBranch, 'bundle assets');

                if (changes && changes.length) {
                    log.info(`Commit : [bundle assets - ${changes.length} files]`);
                    changes.forEach(file => log.info(`  - ${file}`));
                }
            } catch (error) {
                log.error(`Unable to bundle assets. ${error.message}. Continue.`);
            }

            log.done();
        },

        /**
         * Prompt user to confirm release
         * @deprecated - only used in oldWayRelease for backward compatibility / user experience
         */
        async confirmRelease() {
            const { go } = await inquirer.prompt({
                type: 'confirm',
                name: 'go',
                message: `Let's release version ${data.extension.name}@${data.version} 🚀 ?`
            });

            if (!go) {
                log.exit();
            }
        },

        /**
         * Create release on github
         */
        async createGithubRelease() {
            log.doing(`Creating github release ${data.version}`);

            // Start with CLI option, if it's missing we'll prompt user
            let comment = releaseComment;

            if (!comment || !comment.length) {
                ( { comment } = await inquirer.prompt({
                    type: 'input',
                    name: 'comment',
                    message: 'Any comment on the release ?',
                }) );
            }
            const fullReleaseComment = `${comment}\n\n**Release notes :**\n${data.pr.notes}`;

            await githubClient.release(data.tag, fullReleaseComment);

            log.done();
        },

        /**
         * Create relase pull request from releasing branch
         */
        async createPullRequest() {
            log.doing('Create the pull request');

            const pullRequest = await githubClient.createReleasePR(
                data.releasingBranch,
                releaseBranch,
                data.version,
                data.lastVersion
            );

            if (pullRequest && pullRequest.state === 'open') {
                data.pr = {
                    url: pullRequest.html_url,
                    apiUrl: pullRequest.url,
                    number: pullRequest.number,
                    id: pullRequest.id
                };

                log.info(`${data.pr.url} created`);
                log.done();
            } else {
                log.exit('Unable to create the release pull request');
            }
        },

        /**
         * Create and publish release tag
         */
        async createReleaseTag() {
            log.doing(`Add and push tag ${data.tag}`);

            await gitClient.tag(releaseBranch, data.tag, `version ${data.version}`);

            log.done();
        },

        /**
         * Create releasing branch
         */
        async createReleasingBranch() {
            log.doing('Create release branch');

            await gitClient.localBranch(data.releasingBranch);

            log.done(`${data.releasingBranch} created`);
        },

        /**
         * Check if release tag exists
         */
        async doesTagExists() {
            log.doing(`Check if tag ${data.tag} exists`);

            if (await gitClient.hasTag(data.tag)) {
                log.exit(`The tag ${data.tag} already exists`);
            }

            log.done();
        },

        /**
         * Check if releasing branch exists on remote
         */
        async doesReleasingBranchExists() {
            log.doing(`Check if branch remotes/${origin}/${data.releasingBranch} exists`);

            if (await gitClient.hasBranch(`remotes/${origin}/${data.releasingBranch}`)) {
                log.exit(`The remote branch remotes/${origin}/${data.releasingBranch} already exists.`);
            }

            log.done();
        },

        /**
         * Extract release notes from release pull request
         */
        async extractReleaseNotes() {
            log.doing('Extract release notes');

            const releaseNotes = await githubClient
                .extractReleaseNotesFromReleasePR(data.pr.number);

            if (releaseNotes) {
                data.pr.notes = releaseNotes;

                log.info(data.pr.notes);
                log.done();
            } else {
                log.exit('Unable to create the release notes');
            }
        },

        /**
         * Initialise github client for the extension to release repository
         */
        async initialiseGithubClient() {
            const repoName = await taoInstance.getRepoName(data.extension.name);

            if (repoName) {
                githubClient = github(data.token, repoName);
            } else {
                log.exit('Unable to find the github repository name');
            }
        },

        /**
         * Gets the branch with highest version
         * @param {String[]} - the list of branches to compare
         * @returns {Object} with the highest branch and version as property
         */
        getHighestVersionBranch(possibleBranches = []) {
            log.doing('Selecting releasing branch from the biggest version found in branches.');

            const semVerRegex = /(?:(\d+)\.)?(?:(\d+)\.)?(?:(\d+)\.\d+)(-[\w.]+)?/g;
            const versionedBranches = possibleBranches.filter(branch => branch.match(semVerRegex));

            let version = '0.0';
            let branch;

            versionedBranches.forEach(b => {
                const branchVersion = b.replace(`remotes/${origin}/${branchPrefix}-`, '');
                if (compareVersions(branchVersion, version) > 0) {
                    branch = b;
                    version = branchVersion;
                }
            });

            return { branch, version };
        },

        /**
         * Check if there is any diffs between base and release branches and prompt to confirm release user if there is no diffs
         */
        async isReleaseRequired() {
            log.doing(`Diff ${baseBranch}..${releaseBranch}`);
            const hasDiff = await gitClient.hasDiff(baseBranch, releaseBranch);
            if (!hasDiff) {
                const { diff } = await inquirer.prompt({
                    type: 'confirm',
                    name: 'diff',
                    message: `It seems there is no changes between ${baseBranch} and ${releaseBranch}. Do you want to release anyway?`
                });

                if (!diff) {
                    log.exit();
                }
            }

            log.done();
        },

        /**
         * Load and initialise release extension config
         */
        async loadConfig() {
            data = Object.assign({}, await config.load());

            // Request github token if necessary
            if (!data.token) {
                setTimeout(() => opn('https://github.com/settings/tokens'), 2000);

                const { token } = await inquirer.prompt({
                    type: 'input',
                    name: 'token',
                    message: 'I need a Github token, with "repo" rights (check your browser)  : ',
                    validate: token => /[a-z0-9]{32,48}/i.test(token),
                    filter: token => token.trim()
                });

                data.token = token;

                await config.write(data);
            }
        },

        /**
         * Merge release branch back into base branch
         */
        async mergeBack() {
            log.doing(`Merging back ${releaseBranch} into ${baseBranch}`);

            try {
                await gitClient.mergeBack(baseBranch, releaseBranch);
                log.done();
            }
            catch (err) {
                if (err && err.message && err.message.startsWith('CONFLICTS:')) {
                    log.error(`There were conflicts preventing the merge of ${releaseBranch} back into ${baseBranch}.`);
                    log.warn('Please resolve the conflicts and complete the merge manually (including making the merge commit).');

                    const mergeDone = await this.promptToResolveConflicts();
                    if (mergeDone) {
                        if (await gitClient.hasLocalChanges()) {
                            log.exit(`Cannot push changes because local branch '${baseBranch}' still has changes to commit.`);
                        }
                        await gitClient.push(origin, baseBranch);
                        log.done();
                    }
                    else {
                        log.exit(`Not able to bring ${baseBranch} up to date. Please fix it manually.`);
                    }
                }
                else {
                    log.exit(`An error occurred: ${err}`);
                }
            }
        },

        /**
         * Merge release pull request
         */
        async mergePullRequest() {
            setTimeout(() => opn(data.pr.url), 2000);

            const { pr } = await inquirer.prompt({
                type: 'confirm',
                name: 'pr',
                message: 'Please review the release PR (you can make the last changes now). Can I merge it now ?',
            });

            if (!pr) {
                log.exit();
            }

            log.doing('Merging the pull request');

            await gitClient.mergePr(releaseBranch, data.releasingBranch);

            log.done('PR merged');
        },

        /**
         * Merge release branch into releasing branch and ask user to resolve conflicts manually if any
         */
        async mergeWithReleaseBranch() {
            log.doing(`Merging '${releaseBranch}' into '${data.releasingBranch}'.`);

            // checkout master
            await gitClient.checkout(releaseBranch);

            // pull master
            await gitClient.pull(releaseBranch);

            // checkout releasingBranch
            await this.checkoutReleasingBranch();

            try {
                // merge release branch into releasingBranch
                await gitClient.merge([releaseBranch]);

                log.done(`'${releaseBranch}' merged into '${branchPrefix}-${data.version}'.`);
            } catch (err) {
                // error is about merging conflicts
                if (err && err.message && err.message.startsWith('CONFLICTS:')) {
                    log.warn('Please resolve the conflicts and complete the merge manually (including making the merge commit).');

                    const mergeDone = await this.promptToResolveConflicts();
                    if (mergeDone) {

                        if (await gitClient.hasLocalChanges()) {
                            log.exit(`Cannot push changes because local branch '${data.releasingBranch}' still has changes to commit.`);
                        } else {
                            await gitClient.push(origin, data.releasingBranch);
                            log.done(`'${releaseBranch}' merged into '${branchPrefix}-${data.version}'.`);
                        }

                    } else {
                        await gitClient.abortMerge([releaseBranch]);
                        log.exit();
                    }

                } else {
                    log.exit(`An error occurred: ${err}`);
                }
            }
        },

        /**
         * Show a prompt to pause the program and make them confirm they have resolved conflicts.
         * @returns {Promise}
         */
        async promptToResolveConflicts() {
            const { isMergeDone } = await inquirer.prompt({
                name: 'isMergeDone',
                type: 'confirm',
                message: `Has the merge been completed manually? I need to push the branch to ${origin}.`,
                default: false
            });

            return isMergeDone;
        },

        /**
         * Remove releasing branch
         */
        async removeReleasingBranch() {
            log.doing('Clean up the place');

            await gitClient.deleteBranch(data.releasingBranch);

            log.done();
        },

        /**
         * Select and initialise the extension to release
         */
        async selectExtension() {
            // Start with CLI option, if it's missing we'll prompt user
            let extension = extensionToRelease;
            const availableExtensions = await taoInstance.getExtensions();

            if (extension && !availableExtensions.includes(extension)) {
                log.exit(`Specified extension ${extension} not found in ${data.taoRoot}`);
            }
            else if (!extension) {
                ( { extension } = await inquirer.prompt({
                    type: 'list',
                    name: 'extension',
                    message: 'Which extension you want to release ? ',
                    pageSize: 12,
                    choices: availableExtensions,
                    default: data.extension && data.extension.name,
                }) );
            }

            gitClient = gitClientFactory(`${data.taoRoot}/${extension}`, origin, extension);

            data.extension = {
                name: extension,
                path: `${data.taoRoot}/${extension}`,
            };

            await config.write(data);
        },

        /**
         * Select releasing branch
         * - picking version-to-release CLI option and find branch with version on it
         * - or find the biggest version and find branch with version on it
         */
        async selectReleasingBranch() {
            // Filter all branches to the ones that have release in the name
            await gitClient.fetch();
            const allBranches = await gitClient.getLocalBranches();

            if (versionToRelease) {
                const branchName = `remotes/${origin}/${branchPrefix}-${versionToRelease}`;
                if (allBranches.includes(branchName)) {
                    data.releasingBranch = `${branchPrefix}-${versionToRelease}`;
                    data.version = versionToRelease;
                    data.tag = `v${versionToRelease}`;

                } else {
                    log.exit(`Cannot find the branch '${branchName}'.`);
                }
            } else {
                const partialBranchName = `remotes/${origin}/${branchPrefix}-`;
                const possibleBranches = allBranches.filter(branch => branch.startsWith(partialBranchName));
                const highestVersionBranch = this.getHighestVersionBranch(possibleBranches);
                if (highestVersionBranch && highestVersionBranch.branch && highestVersionBranch.version) {
                    data.releasingBranch = `${branchPrefix}-${highestVersionBranch.version}`;
                    data.version = highestVersionBranch.version;
                    data.tag = `v${highestVersionBranch.version}`;

                } else {
                    log.exit(`Cannot find any branches matching '${partialBranchName}'.`);
                }
            }

            if (data.releasingBranch) {
                log.done(`Branch ${data.releasingBranch} is selected.`);
            }
        },

        /**
         * Select and initialise tao instance
         */
        async selectTaoInstance() {
            // Start with CLI option, if it's missing we'll prompt user
            let taoRoot = pathToTao;

            if (!taoRoot) {
                ( { taoRoot } = await inquirer.prompt({
                    type: 'input',
                    name: 'taoRoot',
                    message: 'Path to the TAO instance : ',
                    default: data.taoRoot || process.cwd()
                }) );
            }

            taoInstance = taoInstanceFactory(path.resolve(taoRoot), false, wwwUser);

            const { dir, root } = await taoInstance.isRoot();

            if (!root) {
                log.exit(`${dir} is not a TAO instance`);
            }

            if (!await taoInstance.isInstalled()) {
                log.exit('It looks like the given TAO instance is not installed.');
            }

            data.taoRoot = dir;
        },

        /**
         * Sign tags (todo, not yet implemented)
         */
        async signTags() {
            data.signtags = await gitClient.hasSignKey();
        },

        /**
         * Update and publish translations
         */
        async updateTranslations() {
            log.doing('Translations');

            // Start with CLI option, if it's missing we'll prompt user
            let translation = updateTranslations;

            if (!translation) {
                log.warn('Update translations during a release only if you know what you are doing');

                ( { translation } = await inquirer.prompt({
                    type: 'confirm',
                    name: 'translation',
                    message: `${data.extension.name} needs updated translations ? `,
                    default: false
                }) );
            }

            if (translation) {
                try {
                    await taoInstance.updateTranslations(data.extension.name);

                    const changes = await gitClient.commitAndPush(data.releasingBranch, 'update translations');

                    if (changes && changes.length) {
                        log.info(`Commit : [update translations - ${changes.length} files]`);
                        changes.forEach(file => log.info(`  - ${file}`));
                    }
                } catch (error) {
                    log.error(`Unable to update translations. ${error.message}. Continue.`);
                }
            }

            log.done();
        },

        /**
         * Fetch and pull branches, extract manifests and repo name
         */
        async verifyBranches() {
            const { pull } = await inquirer.prompt({
                type: 'confirm',
                name: 'pull',
                message: `Can I checkout and pull ${baseBranch} and ${releaseBranch}  ?`
            });

            if (!pull) {
                log.exit();
            }

            log.doing(`Updating ${data.extension.name}`);

            await gitClient.pull(releaseBranch);

            const { version: lastVersion } = await taoInstance.parseManifest(`${data.extension.path}/manifest.php`);
            data.lastVersion = lastVersion;
            data.lastTag = `v${lastVersion}`;

            await gitClient.pull(baseBranch);

            const manifest = await taoInstance.parseManifest(`${data.extension.path}/manifest.php`);

            data.extension = manifest;
            data.version = manifest.version;
            data.tag = `v${manifest.version}`;
            data.releasingBranch = `${branchPrefix}-${manifest.version}`;
        },

        /**
         * Verify if local branch has no uncommied changes
         */
        async verifyLocalChanges() {
            log.doing('Checking extension status');

            if (await gitClient.hasLocalChanges()) {
                log.exit(`The extension ${data.extension.name} has local changes, please clean or stash them before releasing`);
            }

            log.done(`${data.extension.name} is clean`);
        },

        /**
         * Verify that the version that we are going to release is valid
         * - is the same on branch name and manifest
         * - is bigger than current release branch version.
         */
        async verifyReleasingBranch() {
            log.doing('Checking out and verifying releasing branch.');

            await this.checkoutReleasingBranch();

            // Cross check releasing branch version with manifest version
            const releasingBranchManifest = await taoInstance.parseManifest(`${data.extension.path}/manifest.php`);
            if (compareVersions(releasingBranchManifest.version, data.version) === 0 ) {
                log.doing(`Branch ${data.releasingBranch} has valid manifest.`);
            } else {
                log.exit(`Branch '${data.releasingBranch}' cannot be released because it's branch name does not match its own manifest version (${releasingBranchManifest.version}).`);
            }

            // Cross check releasing branch wth release branch and make sure new version is highest
            await gitClient.checkout(releaseBranch);
            const releaseBranchManifest = await taoInstance.parseManifest(`${data.extension.path}/manifest.php`);
            if (compareVersions(releasingBranchManifest.version, releaseBranchManifest.version) === 1 ) {
                data.lastVersion = releaseBranchManifest.version;
                data.lastTag = `v${releaseBranchManifest.version}`;

                log.done(`Branch ${data.releasingBranch} is valid.`);
            } else {
                log.exit(`Branch '${data.releasingBranch}' cannot be released because its manifest version (${data.version}) is not greater than the manifest version of '${releaseBranch}' (${releaseBranchManifest.version}).`);
            }
        },

        /**
         * Prompt user if he really want to use deprecated way to do the release
         */
        async warnAboutDeprecation() {
            const { isOldWayReleaseSelected } = await inquirer.prompt({
                type: 'confirm',
                name: 'isOldWayReleaseSelected',
                message: 'This release process is deprecated. Are you sure you want to continue?',
                default: false
            });

            if (!isOldWayReleaseSelected) {
                log.exit();
            }
        }

    };
};