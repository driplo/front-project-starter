var gulp = require('gulp'),
    w3cjs = require('gulp-w3cjs'),
    headerfooter = require('gulp-headerfooter'),
    concat = require('gulp-concat');

gulp.task('header-footer', function () {
    gulp.src('pilote/src/*.html')
        .pipe(headerfooter.header('./pilote/src/templates/header.html'))
        .pipe(headerfooter.footer('./pilote/src/templates/footer.html'))
        .pipe(gulp.dest('./pilote/public/'))
        .pipe(w3cjs());
});

/*gulp.task('w3cjs', function () {
    gulp.src('pilote/src/*.html')
        
        .pipe(concat('index.html'))
        .pipe(gulp.dest('pilote/public/'));
});*/