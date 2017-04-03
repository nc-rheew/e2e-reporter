const fs = require('fs');
const path = require('path');

const E2EReporter = function (baseReporterDecorator, config, logger, helper) {
  const e2eLogger = logger.create('reporter.e2e');
  const allLogs = [];
  const reporterConfig = config.e2eReporter || {};
  let outputDir = reporterConfig.outputDir || '.';

  outputDir = helper.normalizeWinPath(path.resolve(config.basePath, outputDir)) + path.sep;

  baseReporterDecorator(this);

  const writeToFile = function (jsonToWrite) {
    const newOutputFile = path.join(outputDir, 'E2E-MASTER-LOG-' + Date.now() + '.json');
    if (!jsonToWrite) {
      return;
    }

    helper.mkdirIfNotExists(path.dirname(newOutputFile), function () {
      fs.writeFile(newOutputFile, JSON.stringify(jsonToWrite), function (err) {
        if (err) {
          e2eLogger.warn('Cannot write\n\t' + err);
        } else {
          e2eLogger.debug('Results written to "%s".', newOutputFile);
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

  this.onBrowserComplete = function (browser) {
    let jsonToWrite = [];

    let userObj;

    allLogs.forEach(function(log) {
      switch (log.type) {
        case 'testStart':
          userObj = {
            testType: log.testType,
            email: log.email,
            scenario: log.scenario,
            requests: [],
            accounts: [],
            tests: {}
          };
          jsonToWrite.push(userObj);
          break;
        case 'requestId':
          userObj.requests.push({
            loggingId: log.loggingId,
            url: log.url,
            errors: null
          });
          break;
        case 'error':
          userObj.requests.push({
            loggingId: log.loggingId,
            url: log.url,
            errors: {
              message: log.message,
              status: log.status
            }
          });
          break;
        case 'equality':
          userObj.tests[log.valueName] = {
            expected: log.expected,
            actual: log.actual,
            diff: log.expected - log.actual
          };
          break;
        case 'directional':
          userObj.tests[log.valueName] = {
            initial: log.initial,
            result: log.result,
            name: log.valueName,
            testResult: log.testResult
          };
          break;
        case 'accountContribution':
          userObj.accounts.push(log.contributionsPerAccount);
          break;
        default:
          break;
      }
    });

    writeToFile(jsonToWrite);

    jsonToWrite = null;
  };

  this.onExit = function (done) {
    done();
  };
};

E2EReporter.$inject = ['baseReporterDecorator', 'config', 'logger', 'helper'];

module.exports = {
  'reporter:e2e': ['type', E2EReporter]
};
