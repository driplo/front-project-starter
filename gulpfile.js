var gulp = require('gulp');

require('require-dir')('./gulp');
gulp.task('default', [
  'images',
  'styles',
  'scripts'
]);
