/**
 *
 * Unit test the mergePullRequest method of module src/release.js
 *
 * @copyright 2019 Open Assessment Technologies SA;
 * @author Anton Tsymuk <anton@taotesting.com>
 */

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const sandbox = sinon.sandbox.create();

const branchPrefix = 'release';
const config = {
    write: () => { },
};
const extension = 'testExtension';
const githubInstance = {
    createReleasePR: () => ({ state: 'open' })
};
const githubFactory = sandbox.stub().callsFake(() => githubInstance);
const gitClientInstance = {
    pull: () => { },
    mergePr: () => { },
};
const gitClientFactory = sandbox.stub().callsFake(() => gitClientInstance);
const log = {
    exit: () => { },
    doing: () => { },
    done: () => { },
    info: () => { },
};
const taoRoot = 'testRoot';
const inquirer = {
    prompt: () => ({ extension, taoRoot, pr: true }),
};
const version = '1.1.1';
const releaseBranch = 'testReleaseBranch';
const taoInstance = {
    getExtensions: () => [],
    getRepoName: () => 'testRepo',
    isInstalled: () => true,
    isRoot: () => ({ root: true, dir: taoRoot }),
    parseManifest: () => ({ version })
};
const taoInstanceFactory = sandbox.stub().callsFake(() => taoInstance);
const open = sandbox.spy();
const release = proxyquire.noCallThru().load('../../../../src/release.js', {
    './config.js': () => config,
    './git.js': gitClientFactory,
    './github.js': githubFactory,
    './log.js': log,
    './taoInstance.js': taoInstanceFactory,
    inquirer,
    open,
})(null, branchPrefix, null, releaseBranch);

test('should define mergePullRequest method on release instance', (t) => {
    t.plan(1);

    t.ok(typeof release.mergePullRequest === 'function', 'The release instance has mergePullRequest method');

    t.end();
});

test('should open pull request in browser', async (t) => {
    t.plan(1);

    const clock = sandbox.useFakeTimers();

    await release.selectTaoInstance();
    await release.selectExtension();
    await release.verifyBranches();
    await release.initialiseGithubClient();
    await release.createPullRequest();

    open.resetHistory();

    await release.mergePullRequest();

    clock.tick(2000);

    t.equal(open.callCount, 1, 'Browser has been opened');

    clock.restore();
    t.end();
});

test('should prompt about merging pull request', async (t) => {
    t.plan(4);

    await release.selectTaoInstance();
    await release.selectExtension();
    await release.verifyBranches();
    await release.initialiseGithubClient();
    await release.createPullRequest();

    sandbox.stub(inquirer, 'prompt').callsFake(({ type, name, message }) => {
        t.equal(type, 'confirm', 'The type should be "confrim"');
        t.equal(name, 'pr', 'The param name should be pr');
        t.equal(message, 'Please review the release PR (you can make the last changes now). Can I merge it now ?', 'Should disaplay appropriate message');


        return { pr: true };
    });

    await release.mergePullRequest();

    t.equal(inquirer.prompt.callCount, 1, 'Prompt has been initialised');

    sandbox.restore();
    t.end();
});

test('should log exit if pr is not confirmed', async (t) => {
    t.plan(1);

    await release.selectTaoInstance();
    await release.selectExtension();
    await release.verifyBranches();
    await release.initialiseGithubClient();
    await release.createPullRequest();

    sandbox.stub(inquirer, 'prompt').returns({ pr: false });
    sandbox.stub(log, 'exit');

    await release.mergePullRequest();

    t.equal(log.exit.callCount, 1, 'Exit has been logged');

    sandbox.restore();
    t.end();
});

test('should log doing message', async (t) => {
    t.plan(2);

    await release.selectTaoInstance();
    await release.selectExtension();
    await release.verifyBranches();
    await release.initialiseGithubClient();
    await release.createPullRequest();

    sandbox.stub(log, 'doing');

    await release.mergePullRequest();

    t.equal(log.doing.callCount, 1, 'Doing has been logged');
    t.ok(log.doing.calledWith('Merging the pull request'), 'Doing has been logged with apropriate message');

    sandbox.restore();
    t.end();
});

test('should merge pull request', async (t) => {
    t.plan(2);

    await release.selectTaoInstance();
    await release.selectExtension();
    await release.verifyBranches();
    await release.initialiseGithubClient();
    await release.createPullRequest();

    sandbox.stub(gitClientInstance, 'mergePr');

    await release.mergePullRequest();

    t.equal(gitClientInstance.mergePr.callCount, 1, 'PR has been merged');
    t.ok(
        gitClientInstance.mergePr.calledWith(
            releaseBranch,
            `${branchPrefix}-${version}`
        ),
        'Apropriated PR has been merged',
    );

    sandbox.restore();
    t.end();
});

test('should log done message', async (t) => {
    t.plan(2);

    await release.selectTaoInstance();
    await release.selectExtension();
    await release.verifyBranches();
    await release.initialiseGithubClient();
    await release.createPullRequest();

    sandbox.stub(log, 'done');

    await release.mergePullRequest();

    t.equal(log.done.callCount, 1, 'Done has been logged');
    t.ok(log.done.calledWith('PR merged'), 'Done has been logged with apropriate message');

    sandbox.restore();
    t.end();
});
