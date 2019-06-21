/**
 *
 * Unit test the loadConfig method of module src/release.js
 *
 * @copyright 2019 Open Assessment Technologies SA;
 * @author Anton Tsymuk <anton@taotesting.com>
 */

const proxyquire = require('proxyquire');
const sinon = require('sinon');
const test = require('tape');

const sandbox = sinon.sandbox.create();

const config = {
    load: () => ({}),
    write: () => { },
};
const inquirer = {
    prompt: () => ({}),
};
const open = sandbox.spy();
const release = proxyquire.noCallThru().load('../../../../src/release.js', {
    './config.js': () => config,
    inquirer,
    open,
})();

test('should define loadConfig method on release instance', (t) => {
    t.plan(1);

    t.equal(typeof release.loadConfig, 'function', 'The release instance has loadConfig method');

    t.end();
});

test('should load config', async (t) => {
    t.plan(1);

    const data = { token: 'testToken' };

    sandbox.stub(config, 'load').returns(data);

    await release.loadConfig();

    t.equal(config.load.callCount, 1, 'Config has been loaded');

    sandbox.restore();
    t.end();
});

test('should open github token settings if there is no token in the config', async (t) => {
    t.plan(2);

    const clock = sandbox.useFakeTimers();

    await release.loadConfig();

    clock.tick(2000);

    t.equal(open.callCount, 1, 'Config has been loaded');
    t.ok(open.calledWith('https://github.com/settings/tokens'));

    clock.restore();
    sandbox.restore();
    t.end();
});

test('should prompt user to provide a token if there is no token in the config', async (t) => {
    t.plan(4);

    sandbox.stub(inquirer, 'prompt').callsFake(({ type, name, message }) => {
        t.equal(type, 'input', 'The type should be "input"');
        t.equal(name, 'token', 'The param name should be token');
        t.equal(message, 'I need a Github token, with "repo" rights (check your browser)  : ', 'Should disaplay appropriate message');

        return {};
    });

    await release.loadConfig();

    t.equal(inquirer.prompt.callCount, 1, 'Prompt has been initialised');

    sandbox.restore();
    t.end();
});

test('should validate provided token', async (t) => {
    t.plan(2);

    const validToken = 'hsajdf234jhsaj234dfhh234asj32dfh';
    const invalidToken = 'invalidToken';

    sandbox.stub(inquirer, 'prompt').callsFake(({ validate }) => {
        t.ok(validate(validToken), 'Validate valid token');
        t.notOk(validate(invalidToken), 'Validate invalid token');

        return {};
    });

    await release.loadConfig();

    sandbox.restore();
    t.end();
});

test('should trim token', async (t) => {
    t.plan(1);

    sandbox.stub(inquirer, 'prompt').callsFake(({ filter }) => {
        t.equal(filter('   testToken   '), 'testToken', 'Validate valid token');

        return {};
    });

    await release.loadConfig();

    sandbox.restore();
    t.end();
});

test('should save provided token', async (t) => {
    t.plan(2);

    const token = 'testToken';

    sandbox.stub(config, 'write');

    sandbox.stub(inquirer, 'prompt').returns({ token });

    await release.loadConfig();

    t.equal(config.write.callCount, 1, 'The config has been saved');
    t.ok(config.write.calledWith({ token }), 'The token has been saved in the config');

    sandbox.restore();
    t.end();
});
