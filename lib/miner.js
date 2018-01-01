'use strict';

const _ = require('lodash');
const ChildProcess = require('child_process');
const Path = require('path');
const Ansi = require('ansi-escape-sequences');
const Split = require('split');
const Os = require('os');

exports = module.exports = class Miner {

    constructor(config) {

        this.isRunning = false;
        this.process = null;
        this.startedOn = null;
        this.stoppedOn = null;

        this.config = Object.assign({
            waitPeriod: 1000 * 60 * 2,
            autoRestartThreshold: 1000 * 60 * 60,
            watchdogTimeout: 1000 * 60 * 2
        }, config);
    }

    start() {

        const args = Object.keys(
            this.config.args).map((key) => [key, '' + this.config.args[key]]);

        const p = ChildProcess.spawn(
            this.config.miner,
            _(args).flatten().compact().value(),
            { detached: false, cwd: Path.dirname(this.config.miner) });

        const processLine = (data) => {

            const line = data.toString();
            if (/error/i.test(line)) {
                process.stderr.write(Ansi.style.red + data + Ansi.style.reset + Os.EOL);
                return this.stop();
            }
            if (/speed/i.test(line)) {
                if (this.clearLine) {
                    process.stdout.write(
                        Ansi.cursor.back(1000) +
                        Ansi.cursor.up() +
                        Ansi.erase.inLine());
                }
                process.stdout.write(Ansi.style.magenta + data + Ansi.style.reset + Os.EOL);
                this.clearLine = true;
            }
            else {
                process.stdout.write(Ansi.style.cyan + data + Ansi.style.reset + Os.EOL);
                this.clearLine = false;
            }
            this.lastMessageOn = Date.now();
        };

        p.stdout.pipe(Split()).on('data', processLine);

        p.stderr.pipe(Split()).on('data', processLine);

        /*
        p.on('close', (code, signal) => {
            this.stop();
        });
        */

        p.on('exit', (code, signal) => {
            console.log(`Miner worker exited ${code} ${signal}`);
            this.stop();
        });

        this.process = p;
        this.isRunning = true;
        this.startedOn = Date.now();
        this.stoppedOn = null;
        this.lastMessageOn = Date.now();
        this.clearLine = false;
    }

    check() {

        if (!this.isRunning) {

            if (Date.now() - this.stoppedOn < this.config.waitPeriod) {
                console.log('In wait period');
                return;
            }

            console.log('Restarting worker');
            return this.start();
        }

        if (Date.now() - this.startedOn > this.config.autoRestartThreshold) {
            console.log('Stopping worker on auto restart threshold');
            return this.stop();
        }

        if (Date.now() - this.lastMessageOn > this.config.watchdogTimeout) {
            console.log('Stopping worker on watchdog timeout');
            return this.stop();
        }
    }

    stop() {

        if (this.isRunning) {
            this.process.kill();
            this.process = null;
            this.isRunning = false;
            this.stoppedOn = Date.now();
            this.clearLine = false;
        }
    }
};
