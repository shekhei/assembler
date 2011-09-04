var version = require('../lib/version.js');
var scenario = require('minimal-test');

scenario('Test version library works')
  .async('Test that express 2.4.4 gets only 2.4.4', function(test){
    version.getPackageDetails("express", "2.4.4", function(package){
      console.log(package);
      test(package.version==="2.4.4");
      test.done();
    });
  })
  .async('Test that minimal-test is using 0.0.2', function(test){
    version.getPackageDetails("minimal-test", ">=0.0.1", function(package){
      test(package.version==="0.0.3");
      test.done();
    });
  })
