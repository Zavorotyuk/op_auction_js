var gulp = require('gulp');
var del = require('del');
var htmlreplace = require('gulp-html-replace');
var runSequence = require('run-sequence');
var concat = require('gulp-concat');
var ngAnnotate = require('gulp-ng-annotate');
var uglify = require('gulp-uglify');
var bytediff = require('gulp-bytediff');
var rename = require('gulp-rename');
var clean = require('gulp-clean');
var cleanCss = require('gulp-clean-css');
var imagemin = require('gulp-imagemin');
var plumber = require('gulp-plumber');
var ngAnnotate = require('gulp-ng-annotate');

//watch
  gulp.task('watch:devel', function() {
    gulp.watch('./**/src/**/*', ['build:devel'])
  });


// common
  gulp.task('clean', function() {
    return gulp.src('./_attachments', {read: false})
      .pipe(clean());
  })


//devel

gulp.task('build:devel',function(callback){
  return runSequence(
      'clean','dev:cp',  callback
  );
});

  gulp.task('dev:cp', function() {
    return gulp.src(['src/**/*'])
      .pipe(gulp.dest('./_attachments/'))
  });


//production

  gulp.task('build:production', function() {
    runSequence('clean', ['replace:html', 'prepare:static',
      'copy:vendors', 'minify:js','minify:img','minify:main.css',
      'copy:other'],
       function() {
         console.log('Configured production environment');
      })
  });


  gulp.task('replace:html', ['replace:esco', 'replace:tenders']);

  gulp.task('replace:esco', function() {
    gulp.src('src/esco/index.html')
      .pipe(htmlreplace({
          'js': '../static/js/main.min.js',
        //  'vendors': '../dist/vendor.js',
          'css': '../static/css/starter-template.min.css'
      }))
      .pipe(gulp.dest('_attachments/esco/'));
  });

  gulp.task('replace:tenders', function() {
    gulp.src('src/tenders/index.html')
      .pipe(htmlreplace({
          'js': '../static/js/main.min.js',
          //'vendors': '../dist/vendor.js',
          'css': '../static/css/starter-template.min.css'
      }))
      .pipe(gulp.dest('_attachments/tenders/'));
  });


  gulp.task('prepare:static', ['minify:js','minify:static/css',
    'minify:static/img','copy:fonts']);


  gulp.task('minify:js', function () {
    gulp.src(['src/static/js/escoModule.js', ,'src/static/js/app.js', 'src/static/js/*.js'])
      .pipe(concat('main.min.js'))
      .pipe(ngAnnotate())
      .pipe(uglify())
      .pipe(gulp.dest('_attachments/static/js'))
  })


  gulp.task('minify:static/css', function() {
    return gulp.src('src/static/css/*.css')
      .pipe(cleanCss({compatibility: 'ie8'}))
      .pipe(rename('starter-template.min.css'))
      .pipe(gulp.dest('_attachments/static/css'));
  });


  gulp.task('minify:static/img', function() {
    gulp.src('src/static/img/*')
    .pipe(imagemin())
    .pipe(gulp.dest('_attachments/static/img'))
  })


  gulp.task('copy:fonts', function() {
    gulp.src('src/static/fonts/*')
    .pipe(gulp.dest('_attachments/static/fonts'))
  })


  gulp.task('minify:main.css', function() {
    gulp.src('src/style/main.css')
    .pipe(cleanCss({compatibility: 'ie8'}))
    .pipe(gulp.dest('_attachments/style/'))
  })


  gulp.task('minify:img', () =>
    gulp.src('src/img/*')
      .pipe(imagemin())
      .pipe(gulp.dest('_attachments/img'))
  );


  gulp.task('copy:vendors', function() {
    gulp.src('src/vendor/**/*')
    .pipe(gulp.dest('_attachments/vendor'))
  })


  gulp.task('copy:other', function() {
    gulp.src(['src/*.xml','src/*.ico','src/*.json','src/get_current_server_time'])
    .pipe(gulp.dest('_attachments'))
  })
