#!/usr/bin/env node
var fs = require('fs');
var child_process = require('child_process');
var Assembler = require('../lib/download.js');

fs.readFile('package.json', function(err, data){
  if(err) {
    console.log("could not open package.json in folder");
    process.exit(1);
    return;
  }
  var json = JSON.parse(data.toString());
  var installer = new Assembler(json, function(paths){
    console.log("paths-------------------------",paths);
    var modulePath = require('path').resolve('./node_modules');
    var mkdir = require('child_process').spawn('mkdir', ['-p', modulePath]);
    mkdir.stderr.on('data', function(chunk){
      process.stderr.write(chunk);
    });
    mkdir.on('exit', function(code){
      for ( var i = 0; i < paths.length; i++ ) {
        console.log("linking "+paths[i].path+" to ./node_modules/"+paths[i].path);
        (function(path){
          require('fs').symlink(path.path, [modulePath,path.name].join("/"), function(err){
            if ( err ) {
              process.stderr.write("failed linking "+path.path+" to ./node_modules/"+path.path+" "+err+"\n");
            } else {
              console.log("linking "+path.path+" to "+[modulePath,path.name].join("/")+" completed!");
            }
          });
        })(paths[i]);
      }
    });
  });
});
//  var modulePath = require('path').resolve("./node_modules");
//  var mkdir = require('child_process').spawn('mkdir', ['-p',modulePath]);
//  var data = JSON.parse(data.toString());
//  mkdir.on('exit', function(code) {
//    if ( code !== 0 ) {
//      process.stderr.write("failed to create: "+modulePath);
//      process.exit(1);
//      return;
//    }
//    var deps = [];
//    for ( var depname in data.dependencies ) {
//      deps.push({name: depname, semver: data.dependencies[depname]});
//    }
//    for ( var depname in data.devDependencies ) {
//      deps.push({name: depname, semver: data.devDependencies[depname]});
//    }
//    var counter = 0;
//    var download = function() {
//      downloader.download(deps[counter].name, deps[counter].semver, function(filepath){
//        require('fs').symlink(filepath, modulePath+"/"+name);
//        console.log("linking "+name+" to "+filepath);
//        if ( counter < deps.length ) {
//          ++counter;
//          download();
//        }
//      });
//    };
//    download();
//  });
//});
//  var data = JSON.parse(data.toString());
//  var libs = [];
//  var errs = {};
//  var hasErrors = false;
//  var linkLibs = function(){
//    for ( var i = 0; i < libs.length ;i++ ) {
//      var child = child_process.spawn('npm', ['link', libs[i], "--local"]);
//      child.stderr.on('data', function(data){
//        process.stderr.write(data);
//      });
//      child.stdout.on('data', function(data){
//        console.log(data.toString());
//      });
//    }
//  };
//  var count = 0;
//  for ( var name in data.dependencies ) {
//    ++count;
//    (function(lib){
//      var child = child_process.spawn('npm', ['install', lib, "-g"]);
//      console.log("installing "+lib);
//      child.stdout.on('data', function(data){
//        console.log(data.toString());
//      });
//      child.stderr.on('data', function(data){
//        errs[lib] = errs[lib] || "";
//        errs[lib] += data;
//        hasErrors = true;
//      });
//      child.on('exit', function(){
//        console.log("end installing: "+lib);
//        if ( typeof errs[lib] == "undefined"  ) {
//          libs.push(lib);
//        } else {
//          process.stderr.write("error installing "+lib+": "+errs[lib]+"\n");
//        }
//        console.log("Just "+count+" more to go!");
//        if ( 0 == --count ) {
//          linkLibs();
//        }
//      });
//    })(name+"@"+data.dependencies[name]);
//  }
//});
