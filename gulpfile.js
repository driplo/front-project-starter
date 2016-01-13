var gulp = require('gulp');
var browserSync = require('browser-sync').create();

// Static server
gulp.task('serve', function() {
    browserSync.init({
        server: {
            baseDir: "./pilote/public/"
        },
        files: ["pilote/public/css/*.css", "pilote/public/*.html", "pilote/public/js/*.js"],
        host: "localhost",
        port: 1337
    });
});

require('require-dir')('./gulp');
gulp.task('default', [
  'images',
  'styles',
  'fonts',
  'vendors',
  'scripts',
  'header-footer'
]);
