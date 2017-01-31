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
var plumber = require('gulp-plumber');

//watch
  gulp.task('watch:devel', () => gulp.watch('./**/src/**/*', ['build:devel']) );


// common
  gulp.task('clean', () =>
    gulp.src('./_attachments', {read: false})
      .pipe(clean())
  );


//devel

  gulp.task('build:devel',(callback) =>
    runSequence('clean','dev:cp',  callback)
  );

  gulp.task('dev:cp', () =>
    gulp.src(['src/**/*'])
      .pipe(gulp.dest('./_attachments/'))
  );


//production

  gulp.task('build:production', () =>
    runSequence('clean', ['replace:html', 'prepare:static',
      'copy:vendors', 'minify:js','minify:img','minify:main.css',
      'copy:other'], () => {
        console.log("Configured production environment");
      })
  );


  gulp.task('replace:html', ['replace:esco', 'replace:tenders']);

  gulp.task('replace:esco', () =>
    gulp.src('src/esco/index.html')
      .pipe(plumber())
      .pipe(htmlreplace({
          'js': '../static/js/main.min.js',
        //  'vendors': '../dist/vendor.js',
          'css': '../static/css/starter-template.min.css'
      }))
      .pipe(plumber.stop())
      .pipe(gulp.dest('_attachments/esco/'))
  );

  gulp.task('replace:tenders', () =>
    gulp.src('src/tenders/index.html')
      .pipe(plumber())
      .pipe(htmlreplace({
          'js': '../static/js/main.min.js',
          //'vendors': '../dist/vendor.js',
          'css': '../static/css/starter-template.min.css'
      }))
      .pipe(plumber.stop())
      .pipe(gulp.dest('_attachments/tenders/'))
  );


  gulp.task('prepare:static', ['minify:js','minify:static/css',
    'minify:static/img','copy:fonts']);


  gulp.task('minify:js', () =>
    gulp.src(['src/static/js/escoModule.js', ,'src/static/js/app.js', 'src/static/js/*.js'])
      .pipe(plumber())
      .pipe(concat('main.min.js'))
      .pipe(ngAnnotate())
      .pipe(uglify())
      .pipe(plumber.stop())
      .pipe(gulp.dest('_attachments/static/js'))
  );


  gulp.task('minify:static/css', () =>
    gulp.src('src/static/css/*.css')
      .pipe(plumber())
      .pipe(cleanCss({compatibility: 'ie8'}))
      .pipe(rename('starter-template.min.css'))
      .pipe(plumber.stop())
      .pipe(gulp.dest('_attachments/static/css'))
  );


  gulp.task('minify:static/img', () =>
    gulp.src('src/static/img/*')
    .pipe(plumber())
    .pipe(imagemin())
    .pipe(plumber.stop())
    .pipe(gulp.dest('_attachments/static/img'))
  );


  gulp.task('copy:fonts', () =>
    gulp.src('src/static/fonts/*')
    .pipe(gulp.dest('_attachments/static/fonts'))
  );


  gulp.task('minify:main.css', () =>
    gulp.src('src/style/main.css')
    .pipe(plumber())
    .pipe(cleanCss({compatibility: 'ie8'}))
    .pipe(plumber.stop())
    .pipe(gulp.dest('_attachments/style/'))
  );


  gulp.task('minify:img', () =>
    gulp.src('src/img/*')
      .pipe(plumber())
      .pipe(imagemin())
      .pipe(plumber.stop())
      .pipe(gulp.dest('_attachments/img'))
  );


  gulp.task('copy:vendors', () =>
    gulp.src('src/vendor/**/*')
    .pipe(gulp.dest('_attachments/vendor'))
  );


  gulp.task('copy:other', () =>
    gulp.src(['src/*.xml','src/*.ico','src/*.json','src/get_current_server_time'])
    .pipe(gulp.dest('_attachments'))
  );
