var http = require('http');
var version = require('./version.js');
var prefix = "/usr/lib/assembler/";

var download = module.exports.download = function(name, semver, cb){
  //check if the package exists
  version.getPackageDetails(name, semver, function(json){
    var path = require('path').resolve([prefix,json.name].join("/"));
    require('path').exists(path+"/"+json.version, function(exists){
      if ( exists ) { // we are done
        console.log([path,json.version].join("/")+" already exists, using this path");
        var jsonPath = path+"/"+json.version+"/package.json";
        var versionPath = path+"/"+json.version;
        require('fs').readFile(jsonPath, function(err, data){
          if ( err ) {
            process.stderr.write("Failed to parse package.json: "+jsonPath);
            return cb(null);
          }
          var json = JSON.parse(data.toString());
          var mkModuleDir = require('child_process').spawn("mkdir", ["-p", versionPath+"/node_modules"]);
          mkModuleDir.on('exit', function(code) {
            if ( code !== 0 ) {
              process.stderr.write("Failed to create: "+versionPath+"/node_moduels");
              return cb(null);
            }
            getDependencies(json, function(err, paths){
              if ( err ) {
                process.stderr.write("Failed to download dependencies: "+versionPath+"\n"+err);
                return cb(null);
              }
              //lets make the node_modules folder
              for ( var i = 0; i < paths.length; i++ ) {
                console.log("linking "+paths[i].path+" to "+[versionPath,"node_modules",paths[i].name].join("/"));
                if ( !require('path').existsSync([versionPath,"node_modules",paths[i].name].join("/")) ){
                  require('fs').symlinkSync(paths[i].path, [versionPath,"node_modules",paths[i].name].join("/"));
                }
              }
              console.log("Complete installing "+versionPath);
              cb(versionPath);
            });
          });
        });
        return cb(path+"/"+json.version);
      } else {
        var download = require('url').parse(json.dist.tarball);
        var mkdir = require("child_process").spawn("mkdir", ["-p", path+"/"+json.version]);
        mkdir.on('exit', function(code){
          if ( code === 0 ) {
            //success
            var filepath = path+"/"+json.version+".tgz";
            var is = require('fs').createWriteStream(filepath);
            http.get({host:download.host, path:download.pathname}, function(res){
              console.log(res.statusCode, json.dist.tarball);
              if ( res.statusCode !== 200 ) {
                process.stderr.write("Failed to download: "+json.dist.tarball);
                return cb(null);
              }
              var data = [];
              require('util').pump(res, is);
              res.on('end',function(){
                is.end();
                var tar = require('child_process').spawn("tar",['mxvf',filepath,"-C",path+"/"+json.version, "--strip-components=1"]);
                tar.on('exit', function(code){
                  console.log("tar code:"+code);
                  if ( code !== 0 ) {
                    //failed
                    process.stderr.write("Failed to unpack: "+filepath);
                    return cb(null);
                  }
                  var jsonPath = path+"/"+json.version+"/package.json";
                  var versionPath = path+"/"+json.version;
                  require('fs').readFile(jsonPath, function(err, data){
                    if ( err ) {
                      process.stderr.write("Failed to parse package.json: "+jsonPath);
                      return cb(null);
                    }
                    var json = JSON.parse(data.toString());
                    var mkModuleDir = require('child_process').spawn("mkdir", ["-p", versionPath+"/node_modules"]);
                    mkModuleDir.on('exit', function(code) {
                      if ( code !== 0 ) {
                        process.stderr.write("Failed to create: "+versionPath+"/node_moduels");
                        return cb(null);
                      }
                      getDependencies(json, function(err, paths){
                        if ( err ) {
                          process.stderr.write("Failed to download dependencies: "+versionPath+"\n"+err);
                          return cb(null);
                        }
                        //lets make the node_modules folder
                        for ( var i = 0; i < paths.length; i++ ) {
                          console.log("linking "+paths[i].path+" to "+[versionPath,"node_modules",paths[i].name].join("/"));
                          require('fs').symlinkSync(paths[i].path, [versionPath,"node_modules",paths[i].name].join("/")); 
                        }
                        console.log("Complete installing "+versionPath);
                        cb(versionPath);
                      });
                    });
                  });
                });
              });
            });
          } else {
            cb(null);
          }
        });
      }
    });
  });
};

var getDependencies = module.exports.getDependencies = function(json, cb){
  var dependencies = json.dependencies || {};
  if ( json.devDependencies ) {
    for ( var name in json.devDependencies ) {
      dependencies[name] = json.devDependencies[name];
    }
  }
  if ( dependencies ) {
    var count = 0;
    var errs = [];
    var paths = [];
    for ( var depend in dependencies ) {
      ++count;
      (function(name, version){
        download(name, version, function(path){
          if ( path ) {
            --count;
            console.log("done installing dependency to: "+path);
            paths.push({name:name,path:path});
          } else {
            //failed
            errs.push("Failed to download: "+depend+"@"+dependencies[depend]);
          }
          if ( count <= 0 ) {
            cb((errs.length > 0 ? errs : null), paths);
          }
        });
      })(depend, dependencies[depend]);
    }
  }
}
