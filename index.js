const path = require('path');
const fs = require('fs');

const E2EReporter = function (baseReporterDecorator, config, logger, helper) {
  const log = logger.create('reporter.e2e');
  const allLogs = [];
  const reporterConfig = config.e2eReporter || {};
  let outputDir = reporterConfig.outputDir || '.';

  outputDir = helper.normalizeWinPath(path.resolve(config.basePath, outputDir)) + path.sep;

  baseReporterDecorator(this);

  this.adapters = [
    function (msg) {
      const objectMatch = msg.match(/{".+":.+,.+\}/);
      if (objectMatch) {
        allLogs.push(JSON.parse(objectMatch[0]));
      }
    }
  ];

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

  // "browser_start" - a test run is beginning in _this_ browser
  this.onBrowserStart = function (browser) {
  }

  // "browser_complete" - a test run has completed in _this_ browser
  this.onBrowserComplete = function (browser) {
    let jsonToWrite = {};

    allLogs.sort(function(a, b) {
      return a.timestamp - b.timestamp;
    });

    let requests = [];
    let currentMatch = null;
    let currentUser;
    for (var i = 0; i < allLogs.length; i++) {
      const logObj = allLogs[i];

      if (logObj.endOfTest && currentUser) {
        if (currentMatch > -1 && !jsonToWrite[currentUser].currentScenario.requests) {
          jsonToWrite[currentUser].currentScenario.requests = [...requests];
          requests = [];
        } else if (currentMatch === -1 && !jsonToWrite[currentUser].advisedScenario.requests) {
          jsonToWrite[currentUser].advisedScenario.requests = [...requests];
          requests = [];
        }
      }

      if (logObj.type === 'console_log') {
        requests.push({
          loggingId: logObj.loggingId || null,
          url: logObj.url,
          errors: logObj.errors
        });
      }

      if (!jsonToWrite[logObj.email] && logObj.email) {
        jsonToWrite[logObj.email] = {};
      }

      if (jsonToWrite[logObj.email] && logObj.valueName) {
        currentUser = logObj.email;
        currentMatch = logObj.valueName.search(/current/);
        if (currentMatch > -1) {
          if (!jsonToWrite[logObj.email].currentScenario) {
            jsonToWrite[logObj.email].currentScenario = {};
          }

          jsonToWrite[logObj.email].currentScenario[logObj.valueName] = {
            actual: logObj.actual,
            expected: logObj.expected
          };
        } else {
          if (!jsonToWrite[logObj.email].advisedScenario) {
            jsonToWrite[logObj.email].advisedScenario = {};
          }

          jsonToWrite[logObj.email].advisedScenario[logObj.valueName] = {
            actual: logObj.actual,
            expected: logObj.expected
          };
        }
      }
    }

    writeToFile(jsonToWrite);

    // Release memory held by the test suite.
    jsonToWrite = null;
  };

  this.onSpecComplete = function(browser, result) {
    allLogs.push({
      timestamp: Date.now(),
      endOfTest: true
    });
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
