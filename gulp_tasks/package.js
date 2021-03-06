// PACKAGE
// =======
// Create a self-contained version of the FreeNAS webapp that can be used in
// the actual OS.

"use strict";

var gulp  = require( "gulp" );
var path  = require( "path" );
var shell = require( "gulp-shell" );
var argv  = require( "yargs" ).argv;

gulp.task( "make-output-dir"
         , shell.task([ "mkdir -p " + argv.output ])
);

gulp.task( "package-build"
         , [ "webpack", "images", "favicons", "make-output-dir" ]
         , function () {
  return gulp.src( "./app/build/**" )
    .pipe( gulp.dest( path.join( argv.output, "app", "build" ) ) );
});

gulp.task( "package-scripts"
         , [ "make-output-dir" ]
         , function () {
  return gulp.src( "./app/scripts/**" )
    .pipe( gulp.dest( path.join( argv.output, "app", "scripts" ) ) );
});

gulp.task( "package-node-modules"
         , [ "make-output-dir", "prune-production" ]
         , function () {
  return gulp.src( "./node_modules/**" )
    .pipe( gulp.dest( path.join( argv.output, "node_modules" ) ) );
});
