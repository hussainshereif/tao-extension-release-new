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

const log = require('../log.js');

const commander = require('commander');
const program = new commander.Command();

const cliOptions =  require('./cliOptions');

program
    .name('taoRelease prepareRelease')
    .usage('[options]')
    .option(...cliOptions.debug)
    // options with defaults
    .option(...cliOptions.baseBranch)
    .option(...cliOptions.branchPrefix)
    .option(...cliOptions.origin)
    .option(...cliOptions.releaseBranch)
    .option(...cliOptions.wwwUser)
    // options which fall back to user prompts if undefined
    .option(...cliOptions.pathToTao)
    .option(...cliOptions.extensionToRelease)
    .option(...cliOptions.updateTranslations)
    .parse(process.argv);

if (program.debug) console.log(program.opts());

const release = require('../release')(program.opts());

async function prepareRelease() {
    try {
        log.title('TAO Extension Release: prepareRelease');

        await release.loadConfig();
        await release.selectTaoInstance();
        await release.selectExtension();
        await release.verifyLocalChanges();
        await release.verifyBranches();
        await release.doesTagExists();
        await release.doesReleasingBranchExists();
        await release.isReleaseRequired();
        await release.createReleasingBranch();
        await release.compileAssets();
        await release.updateTranslations();

        log.done('Release branch prepared, and pushed to remote.').exit();
    } catch (error) {
        log.error(error).exit();
    }
}

prepareRelease();