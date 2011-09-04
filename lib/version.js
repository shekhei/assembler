var semver = require('semver');
var http = require('http');
var registry = "http://registry.npmjs.org/"

module.exports.getPackageDetails = function(name, ver, cb) {
  http.get({host:"registry.npmjs.org", path:"/"+name}, function(res){
    if ( res.statusCode !== 200 ) {
      cb(null);
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
      cb(package.versions[fit]);
    });
  });
}
