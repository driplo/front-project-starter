var gulp = require('gulp'),
  styles = require('./styles'),
  images = require('./images'),
  scripts = require('./scripts'),
  jslint = require ('./scripts');

// Rerun the task when a file changes
gulp.task('watch', function() {
  gulp.watch('pilote/src/less/*.less', ['styles']);
  gulp.watch('pilote/src/images/*', ['images']);
  /*gulp.watch('pilote/src/js/*.js', ['jslint']);*/
  gulp.watch('pilote/src/js/**/*.js', ['scripts']);
  gulp.watch('pilote/src/**/*.html', ['header-footer']);
});
