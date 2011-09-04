var http = require('http');
var version = require('./version.js');

var prefix = "/usr/lib/assembler";

var Assembler = module.exports = function(json, cb){
  this.downloading = {};
  this.pendingLinks = {};
  var self = this;
  this.install(json, function(err, paths){
    self.link();
    cb(paths);
  });
};

Assembler.prototype.downloading = {};
Assembler.prototype.pendingLinks = {};
Assembler.prototype.install = function(json, cb){
  console.log("install: "+json.name+"@"+json.version);
  var folder = [prefix,json.name].join("/");
  var versionFolder = [folder,json.version].join("/");
  var deps = json.dependencies || {};
  if ( json.devDependencies ) {
    for ( var name in json.devDependencies ) {
      deps[name] = json.devDependencies[name];
    }
  }
  var count = 0;
  var paths = [];
  var self = this;
  for ( var depname in deps ) {
    ++count;
    (function(name){
      self.download(name, deps[name], function(path){
        --count;
        paths.push({name:name, path:path});
        if ( count <= 0 ) {
          cb(null, paths);
        }
      });
    })(depname);
  }
};

Assembler.prototype.link = function(){
  var self = this;
  for ( var name in self.downloading ) {
    self.linkProject(name, self.downloading[name]);
  }
};

Assembler.prototype.linkProject = function(name, linkData){
  var jsonPath = [linkData.path, "package.json"].join("/");
  var self = this;
  var modulePath = [linkData.path,"node_modules"].join("/");
  var mkdir = require('child_process').spawn('mkdir', ["-p", modulePath]);
  mkdir.on('exit', function(code) {
    if ( code !== 0 ) {
      process.stderr.write("Failed to create: "+modulePath);
    }
    require('fs').readFile(jsonPath, function(err, data){
      if ( err ) {
        process.stderr.write("Failed to parse/read: "+jsonPath+" "+err);
        return;
      }
      var json = JSON.parse(data.toString());
      var deps = json.dependencies || {};
      if ( json.devDependencies ) {
        for ( var name in json.devDependencies ) {
          deps[name] = json.devDependencies[name];
        }
      }
      for ( var name in deps ) {
        (function(linkPath){
          require('path').exists(linkPath, function(exists){
            if ( exists ) {
              console.log("already linked: "+[modulePath,name].join("/"));
              return;
            }
            console.log("linking: "+linkPath+" to "+[modulePath,name].join("/"));
            require('fs').symlink(linkPath, [modulePath,name].join("/"), function(err){
              if ( err ) {
                process.stderr.write("Failed to link: "+linkPath+" to "+[modulePath,name].join("/")+"... "+err+"\n");
              } else {
                console.log(linkPath+" linked to "+[modulePath,name].join("/")+" successfully");
              }
            });
          });
        })([prefix,name,linkData.version].join("/"));
      }
    });
  });
};

Assembler.prototype.download = function(name, semver, cb){
  var self = this;
  version.getPackageDetails(name, semver, function(json){
    var fullname = [json.name, json.version].join("@");
    if (self.downloading[fullname]){
      return cb(self.downloading[fullname].path);
    }
    var versionPath = [prefix,json.name,json.version].join("/");
    var tmpPath = [prefix,json.name,json.version+".tgz"].join("/");
    self.downloading[fullname] = {path:versionPath, version:json.version};
    version.getPackageDetails(name, semver, function(json){
      require('path').exists(versionPath, function(exists){
        if ( exists ) {
          console.log(versionPath+" already exists, using that to link");
          cb(versionPath);
        } else {
          console.log("downloading "+json.dist.tarball);
          var mkdir = require('child_process').spawn('mkdir', ['-p', versionPath]);
          mkdir.on('exit', function(code){
            var download = require('url').parse(json.dist.tarball);
            var is = require('fs').createWriteStream(tmpPath);
            http.get({host:download.host, path:download.pathname}, function(res) {
              if ( res.statusCode !== 200 ) {
                process.stderr.write("Failed to download: "+json.dist.tarball);
              }
              console.log("pumping "+json.dist.tarball+" to "+tmpPath);
              require('util').pump(res,is);
              res.on('end', function(){
                is.end();
                var tar = require('child_process').spawn('tar', ['mxvf', tmpPath, "-C", versionPath, "--strip-components=1"]);
                tar.stderr.on('data', function(chunk){
                  process.stderr.write(chunk);
                });
                tar.on('exit', function(code){
                  if ( code !== 0 ){
                    process.stderr.write("Failed to unpack: "+tmpPath);
                    return cb(null);
                  }
                  var jsonPath = [versionPath,"package.json"].join("/");
                  require('fs').readFile(jsonPath, function(err, data){
                    if ( err ) {
                      process.stderr.write("Failed to parse package.json: "+jsonPath);
                      return cb(null);
                    }
                    var json = JSON.parse(data.toString());
                    self.install(json, function(){
                      cb(versionPath);
                    });
                  });
                });
              });
            }).on('error', function(e){
              process.stderr.write("Failed to download: "+e);
            });
          });
        }
      });
    });
  });
};
