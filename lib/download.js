var http = require('http');
var version = require('./version.js');
var fs = require('fs');
var prefix = "/usr/lib/assembler";

var Assembler = module.exports = function(json, cb){
  this.downloading = {};
  this.pendingLinks = {};
  var self = this;
  var timeout = setTimeout(function(){
    for ( var name in this.progress ) {
      console.log("downloading "+name+" "+this.progress[name].current/this.progress[name].total+"%");
    }
  },1000);
  this.install(json, function(err, paths){
    self.link();
    cb(paths);
    clearTimeout(timeout);
  });
};

Assembler.prototype.downloading = {};
Assembler.prototype.progress = {};
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
  var hasDeps = false;
  for ( var depname in deps) {
    hasDeps = true;
    (function(name){
      self.download(name, deps[name], function(path){
        console.log("completed download dep: "+name+"@"+deps[name]+" for "+json.name+"@"+json.version);
        paths.push({name:name, path:path});
        delete deps[name];
        for ( var dep in deps ) {
          for ( var depn in deps ) {
            console.log("pending... "+depn+"@"+deps[depn]);
          }
          return; // so if there's any, it will continue to next
        }
        // there are not a single dep left
        console.log("complete downloading deps for: "+folder);
        return cb(null, paths);
      });
    })(depname);
  }
  if ( !hasDeps ) {
    console.log("completed installing "+json.name+"@"+json.version+": has no deps");
    cb(null, []);
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
  fs.mkdir(modulePath, "0777", function(err) {
  //var mkdir = require('child_process').spawn('mkdir', ["-p", modulePath]);
  //mkdir.on('exit', function(code) {
    require('path').exists(modulePath, function(exists){
      if ( !exists ) {
        process.stderr.write("Failed to create: "+modulePath+" "+err);
        return;
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
        for ( var depname in deps ) {
          (function(linkPath, name){
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
          })([prefix,depname,linkData.version].join("/"), depname);
        }
      });
    });
  });
};

Assembler.prototype.download = function(name, semver, cb){
  var self = this;
  console.log("download("+[name, semver].join(" ,")+")");
  var fullname = [name, semver].join("@");
  if (self.downloading[fullname]){
    console.log("already downloading "+name+"@"+semver+" will link later");
    return cb(self.downloading[fullname].path);
  }
  version.getPackageDetails(name, semver, function(json){
    console.log("found to use "+json.name+"@"+json.version+" checking if already downloading");
    var versionPath = [prefix,json.name,json.version].join("/");
    var tmpPath = [prefix,json.name,json.version+".tgz"].join("/");
    self.downloading[fullname] = {path:versionPath, version:json.version};
    //version.getPackageDetails(name, semver, function(json){
    console.log("found to use "+json.name+"@"+json.version+" checking if "+versionPath+" exists");
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
            require('https').get({host:download.host, path:download.pathname}, function(res) {
              if ( res.statusCode !== 200 ) {
                console.log("Failed to download: "+json.dist.tarball);
                return cb(null);
              }
              self.progress[json.name+"@"+json.version] = {total:res.headers['Content-Length'], current:0};
              console.log("pumping "+json.dist.tarball+" to "+tmpPath);
              res.on('data', function(chunk){
                is.write(chunk);
                self.progress[json.name+"@"+json.version].current += chunk.length;
              });
              res.on('end', function(){
                is.end();
                var tar = require('child_process').spawn('tar', ['mxvf', tmpPath, "-C", versionPath, "--strip-components=1"]);
                var err = "";
                tar.stderr.on('data', function(chunk){
                  err += chunk.toString();
                });
                tar.on('exit', function(code){
                  if ( code !== 0 ){
                    process.stderr.write("Failed to unpack: "+tmpPath+" "+err);
                    require('child_process').spawn('rm', ['-rf', tmpPath]);
                    require('child_process').spawn('rm', ['-rf', versionPath]);
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
              cb(null);
            });
          });
        }
      });
    //});
  });
};
