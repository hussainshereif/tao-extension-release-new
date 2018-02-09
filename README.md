# tao-extension-release

This tool automate TAO extension release

## Installation

Please verify installation [prerequisite](#prerequisite). And run : 

```sh
npm i -g @oat-sa/tao-extension-release
```

## Release an extension

Run :

```sh
taoRelease
```

and follow the instructions


## Development

Remove the package if already installed globally :

```sh
npm uninstall -g @oat-sa/tao-extension-release
```

Then clone the sources :

```sh
git clone git@github.com:oat-sa/tao-extension-release.git
cd tao-extension-release
npm install
npm link
```

So the command `taoRelease` will use the sources.


## System Prerequisite
<a name="prerequisite"></a>

#### node.js

You need a recent version of [node.js](https://nodejs.org) for your platform :

 - [Windows installer](https://nodejs.org/dist/v8.7.0/node-v8.7.0-x86.msi)
 - [OSX installer](https://nodejs.org/dist/v8.7.0/node-v8.7.0.pkg)
 - Linux package
```sh
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs
```
 - or using [nvm](https://github.com/creationix/nvm#installation) for multiple versions.

#### git

You need to have the `git` > `1.7.0` command available in your `PATH`.

#### PHP

You also need the `php` command available in your `PATH`.

## Known Issues

### `Task foosass not found`

Everything looks ok but you don't know why the `grunt` task is not found. If you have updated `node` or `npm` recently, you can fix this by : 

```sh
cd tao/views/build
npm reinstall node-sass --force
```

## Release notes

See the [history](HISTORY.md)

## License

Copyright (c) 2017 Open Assessment Technologies SA;
[GNU General Public License v2.0](https://github.com/oat-sa/tao-extension-release/blob/master/LICENSE)
