var gulp = require('gulp');
var del = require('del');
var htmlreplace = require('gulp-html-replace');
var runSequence = require('run-sequence');

//Clean ./_attachments folder

gulp.task('clean', function() {
  return del('_attachments/*')
})

//Copy all files from ./src to _attachments

gulp.task('dev:cp', function() {
       gulp.src(['src/**/*'])
	    .pipe(gulp.dest('_attachments'))
});

//Copy all files from ./src to _attachments

gulp.task('build:devel', function(callback) {
  runSequence('clean', 'dev:cp', function() {
    console.log("Configured development environment");
  });
});

//Copy all files from ./src to _attachments

gulp.task('production', function() {

});

//Change scripts in html pages
