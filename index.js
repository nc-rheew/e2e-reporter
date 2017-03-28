const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const E2EReporter = function (baseReporterDecorator, config, logger, helper) {
  const log = logger.create('reporter.e2e');
  const allLogs = [];
  const reporterConfig = config.e2eReporter || {};
  let outputDir = reporterConfig.outputDir || '.';

  outputDir = helper.normalizeWinPath(path.resolve(config.basePath, outputDir)) + path.sep;

  baseReporterDecorator(this);

  const writeToFile = function (jsonToWrite) {
    const newOutputFile = path.join(outputDir, 'E2E-MASTER-LOG-' + Date.now() + '.json');
    if (!jsonToWrite) {
      return // don't die if browser didn't start
    }

    helper.mkdirIfNotExists(path.dirname(newOutputFile), function () {
      fs.writeFile(newOutputFile, JSON.stringify(jsonToWrite), function (err) {
        if (err) {
          log.warn('Cannot write\n\t' + err);
        } else {
          log.debug('Results written to "%s".', newOutputFile);
        }
      });
    });
  };

  this.adapters = [
    function (msg) {
      const objectMatch = msg.match(/{".+":.+,.+\}/);
      if (objectMatch) {
        allLogs.push(JSON.parse(objectMatch[0]));
      }
    }
  ];

  // "browser_complete" - a test run has completed in _this_ browser
  this.onBrowserComplete = function (browser) {
    let jsonToWrite = [];

    allLogs.sort(function(a, b) {
      return a.timestamp - b.timestamp;
    });

    let userObj;

    for (var i = 0; i < allLogs.length; i++) {
      const logObj = allLogs[i];

      switch (logObj.type) {
        case 'testStart':
          userObj = {
            name: logObj.name,
            email: logObj.email,
            scenario: logObj.scenario,
            requests: [],
            accounts: [],
            tests: {}
          };
          jsonToWrite.push(userObj);
          break;
        case 'requestId':
          userObj.requests.push({
            loggingId: logObj.loggingId,
            url: logObj.url,
            errors: null
          });
          break;
        case 'error':
          userObj.requests.push({
            loggingId: logObj.loggingId,
            url: logObj.url,
            errors: {
              message: logObj.message,
              status: logObj.status
            }
          });
          break;
        case 'test':
          userObj.tests[logObj.valueName] = {
            expected: logObj.expected,
            actual: logObj.actual,
            diff: logObj.expected - logObj.actual
          };
          break;
        case 'directional':
          userObj.tests[logObj.valueName] = {
            initial: logObj.initial,
            result: logObj.result,
            name: logObj.valueName
          };
          break;
        case 'accountContribution':
          userObj.accounts.push(logObj.accountContributions);
          break;
        default:
          break;
      }
    }

    writeToFile(jsonToWrite);

    // Release memory held by the test suite.
    jsonToWrite = null;
  };

  this.onExit = function (done) {
    done();
  };
};

E2EReporter.$inject = ['baseReporterDecorator', 'config', 'logger', 'helper', 'formatError']

// PUBLISH DI MODULE
module.exports = {
  'reporter:e2e': ['type', E2EReporter]
};
