#!/usr/bin/env node
var fs = require('fs');
var child_process = require('child_process');

fs.readFile('package.json', function(err, data){
  if(err) {
    console.log("could not open package.json in folder");
    process.exit(1);
    return;
  }
  var data = JSON.parse(data.toString());
  var libs = [];
  var errs = {};
  var hasErrors = false;
  var linkLibs = function(){
    for ( var i = 0; i < libs.length ;i++ ) {
      var child = child_process.spawn('npm', ['link', libs[i], "--local"]);
      child.stderr.on('data', function(data){
        process.stderr.write(data);
      });
      child.stdout.on('data', function(data){
        console.log(data.toString());
      });
    }
  };
  var count = 0;
  for ( var name in data.dependencies ) {
    ++count;
    (function(lib){
      var child = child_process.spawn('npm', ['install', lib, "-g"]);
      console.log("installing "+lib);
      child.stdout.on('data', function(data){
        console.log(data.toString());
      });
      child.stderr.on('data', function(data){
        errs[lib] = errs[lib] || "";
        errs[lib] += data;
        hasErrors = true;
      });
      child.on('exit', function(){
        console.log("end installing: "+lib);
        if ( typeof errs[lib] == "undefined"  ) {
          libs.push(lib);
        } else {
          process.stderr.write("error installing "+lib+": "+errs[lib]+"\n");
        }
        console.log("Just "+count+" more to go!");
        if ( 0 == --count ) {
          linkLibs();
        }
      });
    })(name+"@"+data.dependencies[name]);
  }
});
