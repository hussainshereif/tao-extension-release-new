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
 *
 * Unit test the verifyLocalChanges method of module src/release.js
 *
 * @author Anton Tsymuk <anton@taotesting.com>
 */

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const sandbox = sinon.sandbox.create();

const config = {
    write: () => { },
};
const extension = 'testExtension';
const gitClientInstance = {
    hasLocalChanges: () => { },
};
const gitClientFactory = sandbox.stub().callsFake(() => gitClientInstance);
const log = {
    doing: () => { },
    done: () => { },
    exit: () => { },
};
const taoRoot = 'testRoot';
const inquirer = {
    prompt: () => ({ extension, taoRoot }),
};
const taoInstance = {
    getExtensions: () => [],
    isInstalled: () => true,
    isRoot: () => ({ root: true, dir: taoRoot }),
};
const taoInstanceFactory = sandbox.stub().callsFake(() => taoInstance);
const release = proxyquire.noCallThru().load('../../../../src/release.js', {
    './config.js': () => config,
    './git.js': gitClientFactory,
    './log.js': log,
    './taoInstance.js': taoInstanceFactory,
    inquirer,
})();

test('should define verifyLocalChanges method on release instance', (t) => {
    t.plan(1);

    t.ok(typeof release.verifyLocalChanges === 'function', 'The release instance has verifyLocalChanges method');

    t.end();
});

test('should log doing message', async (t) => {
    t.plan(2);

    await release.selectTaoInstance();
    await release.selectExtension();

    sandbox.stub(log, 'doing');

    await release.verifyLocalChanges();

    t.equal(log.doing.callCount, 1, 'Notify about starting verification of local changes');
    t.ok(log.doing.calledWith('Checking extension status'), 'Notify about starting verification of local changes with apropriate message');

    sandbox.restore();
    t.end();
});

test('should check if there is any local changes', async (t) => {
    t.plan(1);

    await release.selectTaoInstance();
    await release.selectExtension();

    sandbox.stub(gitClientInstance, 'hasLocalChanges');

    await release.verifyLocalChanges();

    t.equal(gitClientInstance.hasLocalChanges.callCount, 1, 'Local changes has been checked');

    sandbox.restore();
    t.end();
});

test('should log exit message if there is local changes', async (t) => {
    t.plan(2);

    await release.selectTaoInstance();
    await release.selectExtension();

    sandbox.stub(gitClientInstance, 'hasLocalChanges').returns(true);
    sandbox.stub(log, 'exit');

    await release.verifyLocalChanges();

    t.equal(log.exit.callCount, 1, 'Notify about local changes');
    t.ok(log.exit.calledWith(`The extension ${extension} has local changes, please clean or stash them before releasing`), `The extension ${extension} has local changes, please clean or stash them before releasing`);

    sandbox.restore();
    t.end();
});

test('should log done message', async (t) => {
    t.plan(2);

    await release.selectTaoInstance();
    await release.selectExtension();

    sandbox.stub(log, 'done');

    await release.verifyLocalChanges();

    t.equal(log.done.callCount, 1, 'Notify about finishing verification of local changes');
    t.ok(log.done.calledWith(`${extension} is clean`), 'Notify about finishing verification of local changes with apropriate message');

    sandbox.restore();
    t.end();
});