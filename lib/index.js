'use strict';

const Async = require('async');
const Commander = require('commander');
const Miner = require('./miner');

Commander
    .option('-c, --config <file>', 'Config file')
    .parse(process.argv);

let miner = new Miner(require(Commander.config));

process.on('SIGINT', () => {

    if (!miner) {
        return;
    }
    miner.stop();
    miner = null;
    setTimeout(() => {
        process.exit();
    }, 1000);
});

miner.start();

Async.forever((done) => {

    if (!miner) {
        return done('Miner closed!');
    }

    miner.check();
    setTimeout(done, 1000);
});
