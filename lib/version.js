var semver = require('semver');
var http = require('http');
var registry = "http://registry.npmjs.org/"

var cache = {};

module.exports.getPackageDetails = function(name, ver, cb) {
  if ( cache[name+"@"+ver] ) {
    console.log("Version Library: "+name+"@"+ver+"found already downloaded before, using cache");
    return cb(cache[name+"@"+ver]);
  }
  http.get({host:"registry.npmjs.org", path:"/"+name}, function(res){
    if ( res.statusCode !== 200 ) {
      console.log("Version Library: "+name+"@"+ver+"failed to download");
      return cb(null);
    }
    var buffer = [];
    res.on('data', function(chunk) {
      buffer.push(chunk.toString());
    });
    res.on('end', function(){
      var package = JSON.parse(buffer.join(""));
      var fit = null;
      for( var version in package.versions ) {
        if ( semver.satisfies(version, ver) ) {
          if ( !fit ) { fit = version; }
          else if ( semver.gt(version,fit) ) { fit = version; }
        }
      }
      cache[name+"@"+ver] = package.versions[fit];
      cb(package.versions[fit]);
    });
  });
}
