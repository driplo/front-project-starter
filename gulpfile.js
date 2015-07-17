var gulp = require('gulp');
var browserSync = require('browser-sync').create();

// Static server
gulp.task('browser-sync', function() {
    browserSync.init({
        server: {
            baseDir: "./pilote/public/"
        },
        files: ["pilote/public/css/*.css", "pilote/public/*.html", "pilote/public/js/*.js"],
        host: "your.local.ip"
    });
});

require('require-dir')('./gulp');
gulp.task('default', [
  'images',
  'styles',
  'fonts',
  'vendors',
  'vendorsfooter',
  'scripts',
  'header-footer'
]);
