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
 * Copyright (c) 2023 Open Assessment Technologies SA;
 */
jest.mock('../../../../src/log.js', () => ({
    error: jest.fn(() => ({
        exit: jest.fn()
    })),
    exit: jest.fn(() => ({
        exit: jest.fn()
    })),
    doing: jest.fn(),
    info: jest.fn(),
    done: jest.fn(),
    warn: jest.fn()
}));

jest.mock('inquirer', () => ({
    prompt: jest.fn(() => ({ }))
}));

const taoRoot = 'testRoot';
jest.mock('../../../../src/taoInstance.js', () => {
    const originalModule = jest.requireActual('../../../../src/taoInstance.js');
    //Mock the default export
    return {
        __esModule: true,
        ...originalModule,
        default: jest.fn((path, origin) => ({
            buildAssets: jest.fn(),
            getExtensions: jest.fn(() => []),
            isInstalled: jest.fn(() => true),
            isRoot: jest.fn(() => ({ root: true, dir: taoRoot })),
            getRepoName: jest.fn(),
            updateTranslations: jest.fn()
        }))
    };
});

jest.mock('../../../../src/github.js', () => {
    const originalModule = jest.requireActual('../../../../src/github.js');
    //Mock the default export
    return {
        __esModule: true,
        ...originalModule,
        default: jest.fn(() => ({
            createReleasePR: jest.fn(),
            release: jest.fn(),
            extractReleaseNotesFromReleasePR: jest.fn()
        }))
    };
});

jest.mock('../../../../src/git.js', () => {
    const originalModule = jest.requireActual('../../../../src/git.js');
    //Mock the default export
    return {
        __esModule: true,
        ...originalModule,
        default: jest.fn(() => ({
            tag:  jest.fn(arg => arg),
            localBranch:  jest.fn(arg => arg),
            push:  jest.fn(arg => arg),
            hasBranch:  jest.fn(),
            hasTag: jest.fn(),
            getLastTag: jest.fn(),
            hasDiff:  jest.fn(() => true),
            mergeBack: jest.fn()
        }))
    };
});

jest.mock('../../../../src/conventionalCommits.js', () => {
    const originalModule = jest.requireActual('../../../../src/conventionalCommits.js');
    //Mock the default export
    return {
        __esModule: true,
        ...originalModule,
        getNextVersion: jest.fn()
    };
});

jest.mock('../../../../src/config.js', () => {
    const originalModule = jest.requireActual('../../../../src/config.js');
    //Mock the default export
    return {
        __esModule: true,
        ...originalModule,
        default: jest.fn(() => ({
            load:  jest.fn(() => {}),
            write:  jest.fn()
        }))
    };
});

jest.mock('open');

import log from '../../../../src/log.js';
import github from '../../../../src/github.js';
import inquirer from 'inquirer';
import taoInstanceFactory from '../../../../src/taoInstance.js';
import git from '../../../../src/git.js';
import conventionalCommits from '../../../../src/conventionalCommits.js';
import configFactory from '../../../../src/config.js';
import open from 'open';
import releaseFactory from '../../../../src/release.js';

const extension = 'testExtension';
const version = '1.1.1';
const branchPrefix = 'release';
const repoName = 'extension-test';
const tag = 'v1.1.1';
const releaseBranch = 'testReleaseBranch';
const prNumber = '123';
const pr = { notes: 'some pr note', number: prNumber };
const token = 'abc123';
const releaseComment = 'testComment';
const releasingBranch = 'release-1.1.1';
const lastVersion = '1.1.0';
const origin = 'origin';
const baseBranch = 'testBaseBranch';

const data = {
    version,
    extension: { name: extension }
};

beforeEach(() => {
    jest.spyOn(process, 'stdin', 'get').mockReturnValue({ isTTY: true });
    process.stdin.isTTY
});
afterEach(() => {
    jest.clearAllMocks();
});
afterAll(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
});

describe('src/release.js doesTagExists', () => {

    test('should define doesTagExists method on release instance', () => {
        expect.assertions(1);
    
        const release = releaseFactory();
        expect(typeof release.doesTagExists).toBe('function');
    });
    
    test('should check if tag exists', async () => {
        expect.assertions(2);

        const hasTag = jest.fn();
        git.mockImplementationOnce(() => {
            //Mock the default export
            return {
                hasTag
            };
        });
    
        const release = releaseFactory({ branchPrefix, origin });
        release.setData({ releasingBranch, version, tag, token, extension: {} });
        await release.initialiseGitClient();
        await release.doesTagExists();
    
        expect(hasTag).toBeCalledTimes(1);
        expect(hasTag).toBeCalledWith(`v${version}`);
    });
    
    test('should log exit if tag exists', async () => {
        expect.assertions(2);
    
        const hasTag = jest.fn(() => true);
        git.mockImplementationOnce(() => {
            //Mock the default export
            return {
                hasTag
            };
        });
    
        const release = releaseFactory({ branchPrefix, origin });
        release.setData({ releasingBranch, version, tag, token, extension: {} });
        await release.initialiseGitClient();
        await release.doesTagExists();
    
        expect(log.exit).toBeCalledTimes(1);
        expect(log.exit).toBeCalledWith(`The tag v${version} already exists`);
    });
    
    test('should log done message', async () => {
        expect.assertions(1);
    
        const release = releaseFactory({ branchPrefix, origin });
        release.setData({ releasingBranch, version, tag, token, extension: {} });
        await release.initialiseGitClient();
        await release.doesTagExists();
    
        expect(log.done).toBeCalledTimes(1);
    });
});
