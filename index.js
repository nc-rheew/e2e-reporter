const path = require('path');
const fs = require('fs');

const SweetReporter = function (baseReporterDecorator, config, logger, helper) {
  const log = logger.create('reporter.sweet');
  const allMessages = [];
  const reporterConfig = config.sweetReporter || {};
  let outputDir = reporterConfig.outputDir || '.';

  console.log(outputDir);

  outputDir = helper.normalizeWinPath(path.resolve(config.basePath, outputDir)) + path.sep;
  console.log(outputDir);

  baseReporterDecorator(this);

  this.adapters = [
    function (msg) {
      const startMatch = msg.match(/{".+":.+,.+\}/);
      if (startMatch) {
        allMessages.push(JSON.parse(startMatch[0]));
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

    allMessages.sort(function(a, b) {
      return a.timestamp - b.timestamp;
    });

    let requests = [];
    let currentMatch = null;
    let currentUser;
    for (var i = 0; i < allMessages.length; i++) {
      const item = allMessages[i];

      if (item.endOfTest && currentUser) {
        console.log(currentUser);
        if (currentMatch > -1 && !jsonToWrite[currentUser].currentScenario.requests) {
          jsonToWrite[currentUser].currentScenario.requests = [...requests];
        } else if (currentMatch === -1 && !jsonToWrite[currentUser].advisedScenario.requests) {
          jsonToWrite[currentUser].advisedScenario.requests = [...requests];
        }
        requests = [];
      }

      if (item.type === 'console_log') {
        requests.push({
          loggingId: item.loggingId || null,
          url: item.url,
          errors: item.errors
        });
      }

      if (!jsonToWrite[item.email] && item.email) {
        jsonToWrite[item.email] = {};
      }

      if (jsonToWrite[item.email] && item.valueName) {
        currentUser = item.email;
        currentMatch = item.valueName.search(/current/);
        if (currentMatch > -1) {
          if (!jsonToWrite[item.email].currentScenario) {
            jsonToWrite[item.email].currentScenario = {};
          }

          jsonToWrite[item.email].currentScenario[item.valueName] = {
            actual: item.actual,
            expected: item.expected
          };
        } else {
          if (!jsonToWrite[item.email].advisedScenario) {
            jsonToWrite[item.email].advisedScenario = {};
          }

          jsonToWrite[item.email].advisedScenario[item.valueName] = {
            actual: item.actual,
            expected: item.expected
          };
        }
      }
    }

    writeToFile(jsonToWrite);

    // Release memory held by the test suite.
    jsonToWrite = null;
  };

  this.onSpecComplete = function(browser, result) {
    allMessages.push({
      timestamp: Date.now(),
      endOfTest: true
    });
  };

  this.onExit = function (done) {
    done();
  };
};

SweetReporter.$inject = ['baseReporterDecorator', 'config', 'logger', 'helper', 'formatError']

// PUBLISH DI MODULE
module.exports = {
  'reporter:sweet': ['type', SweetReporter]
};
