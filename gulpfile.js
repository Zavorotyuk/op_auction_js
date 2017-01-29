var gulp = require('gulp');
var del = require('del');
var htmlreplace = require('gulp-html-replace');
var runSequence = require('run-sequence');
var concat = require('gulp-concat');

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

gulp.task('build:production', function() {

});

//Change scripts in esco/index.html pages

gulp.task('esco:html', function() {
  gulp.src('src/esco/index.html')
    .pipe(htmlreplace({
        'js': 'static/js/main.min.js',
        'vendors': 'static/vendors/main.min.js'
    }))
    .pipe(gulp.dest('_attachments/esco/'));
});

//Change scripts in tenders/index.html
gulp.task('tenders:html', function() {
  gulp.src('src/tenders/index.html')
    .pipe(htmlreplace({
        'js': 'static/js/main.min.js',
        'vendors': 'static/vendors/main.min.js'
    }))
    .pipe(gulp.dest('_attachments/tenders/'));
});


// Replace html

gulp.task('replace:html', ['esco:html', 'tenders:html']);


//concat js

gulp.task('scripts:concat', function() {
  return gulp.src('src/static/js/*.js')
    .pipe(concat('main.js'))
    .pipe(gulp.dest('_attachments/static/js'));
});
