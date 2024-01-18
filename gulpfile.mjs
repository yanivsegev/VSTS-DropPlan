'use strict';
import {deleteAsync as del} from 'del';
import gulp from 'gulp';
import replace from 'gulp-replace';
import rename from 'gulp-rename';
import concat from 'gulp-concat';
import sourcemaps from 'gulp-sourcemaps';
import fs from 'fs'
import log from 'fancy-log'
import bom from 'gulp-bom'

import mergeStream from 'merge-stream';

import connect from 'gulp-connect';
const webserver =  connect.server;
const livereload = connect.reload;

let publisherId = 'yanivsegev'
try{
    publisherId = fs.readFileSync('publisherid', 'utf8');
    log('Publisher id set to "' + publisherId + '"');
}catch(e){
    log('If your publisher id from microsoft visual studio is not "' + publisherId + '", create a file at the root of the project with your publisher id inside');
}

let css = {
    sourceFiles: ['Styles/main.css', 'node_modules/jquery-ui/dist/themes/base/jquery-ui.min.css'],
    fileName: 'dropPlan',
    environment: {
        dev:{
            path: './dist/dev/Styles/',
            extension: '.css'
        },
        qa:{
            path: './dist/qa/Styles/',
            extension: '.min.css'
        },
        prod:{
            path: './dist/prod/Styles/',
            extension: '.min.css'
        }
    }
};

let js = {
    "outputFiles":[{
        sourceFiles: [
            "scripts/Promise.js"
            ,"scripts/Polyfill.js"
            ,"scripts/components/SprintData.js"
            ,"scripts/components/Workitem.js"
            ,"scripts/components/VSSRepository.js"
            ,"node_modules/jquery/dist/jquery.min.js"
            ,"node_modules/jquery-ui/dist/jquery-ui.min.js"
            ,"node_modules/vss-web-extension-sdk/lib/VSS.SDK.min.js"
            ,"scripts/TableLock.js"
            ,"scripts/DateHealpers.js"
            ,"scripts/DropPlanHelper.js"
            ,"scripts/arrows.js"
            ,"scripts/themes.js"
            ,"scripts/DropPlanVSS.js"
        ],
        fileName: 'dropPlan',
    },{
        sourceFiles: [
            //"scripts/Promise.js"
            //,"scripts/Polyfill.js"
            "scripts/components/VSSSettingsRepository.js"
            ,"node_modules/jquery/dist/jquery.min.js"
            ,"node_modules/jquery-ui/dist/jquery-ui.min.js"
            ,"node_modules/vss-web-extension-sdk/lib/VSS.SDK.min.js"
            ,"scripts/SortableLists.js"
            ,"scripts/DropPlanVSS-Settings.js"
        ],
        fileName: 'dropPlan-settings',
    }],
    environment: {
        dev: {
            path: './dist/dev/scripts/',
            extension: '.js'
        },
        qa: {
            path: './dist/qa/scripts/',
            extension: '.min.js',
            sourceFiles: [
                /*"scripts/ga.js",
                "scripts/trackjs.js"*/
            ]
        },
        prod: {
            path: './dist/prod/scripts/',
            extension: '.min.js',
            sourceFiles: [
                "scripts/ga.js",
                "scripts/trackjs.js"
            ]
        }
    }
};

let Development = {
    Scripts: function(){
        const tasks = js.outputFiles.map(
            (outputfile)=>{
                console.log(outputfile.fileName + js.environment.dev.extension)
                return gulp.src(outputfile.sourceFiles)
                .pipe(concat(outputfile.fileName + js.environment.dev.extension))
                .pipe(sourcemaps.init({loadMaps: true}))
                .pipe(sourcemaps.write('.', {addComment: false}))
                .pipe(gulp.dest(js.environment.dev.path))
                .pipe(livereload());
            }
        )
        console.log("here")
        return mergeStream(tasks);
    },
    Styles: function(){
        return gulp.src(css.sourceFiles)
          .pipe(concat(css.fileName + css.environment.dev.extension))
          .pipe(gulp.dest(css.environment.dev.path))
          .pipe(livereload());
    },
    Env: 'dev'
};
let Production = {
    Scripts: function(){
        return mergeStream(js.outputFiles.map((source)=>{
            return gulp.src(js.environment.prod.sourceFiles.concat([js.environment.dev.path + source.fileName + js.environment.dev.extension]))
                .pipe(concat(source.fileName + js.environment.prod.extension))
                .pipe(sourcemaps.init({loadMaps: true}))
                //.pipe(uglify())
                .pipe(sourcemaps.write('.', {addComment: false}))
                .pipe(bom())
                .pipe(gulp.dest(js.environment.prod.path))
            })
        )
    },
    Styles: function(){
        return gulp.src([css.environment.dev.path + css.fileName + css.environment.dev.extension])
          .pipe(rename({extname: css.environment.prod.extension}))
          .pipe(gulp.dest(css.environment.prod.path));
    },
    Env: 'prod'
};

let QA = {
    Scripts: function(){
        return mergeStream(js.outputFiles.map((source)=>{
            return gulp.src(js.environment.qa.sourceFiles.concat([js.environment.dev.path + source.fileName + js.environment.dev.extension]))
                .pipe(concat(source.fileName + js.environment.qa.extension))
                .pipe(sourcemaps.init({loadMaps: true}))
                //.pipe(uglify())
                .pipe(sourcemaps.write('.', {addComment: false}))
                .pipe(bom())
                .pipe(gulp.dest(js.environment.qa.path))
            })
        )
    },
    Styles: function(){
        return gulp.src([css.environment.dev.path + css.fileName + css.environment.dev.extension])
          .pipe(rename({extname: css.environment.qa.extension}))
          .pipe(gulp.dest(css.environment.qa.path));
    },
    Env: 'qa'
};

function clean(){
    return del('dist');
}

function loadBuildVersion(){
    if(!loadBuildVersion.buildVersion){
        let buildVersion=0;
        try{
            buildVersion = parseInt(fs.readFileSync('buildVersion', 'utf8'))+1;
            log('Build version set to "' + buildVersion + '"');
        }catch(e){
            log('unable to load build version'+e);
        }
        try{
            fs.writeFileSync('buildVersion', ''+buildVersion);
            log('Build version written to disk');
        }catch(e){
            log('unable to save build version' + e);
        }
        loadBuildVersion.buildVersion=buildVersion
    }
    return loadBuildVersion.buildVersion
}

function copyStaticFiles(env){
    return function CopyEnvStaticFiles(){
        return gulp.src(
            [
                'Styles/*.css', '!Styles/jquery-ui.css',
                'images/*',
                'README.md',
                'PrivacyPolicy.md',
                'LICENSE'
            ],
            { base: '.' }
        ).pipe(gulp.dest('./dist/' + env + '/'));
    }
}

function copyNodeScripts(env){
    return function CopyEnvNodeScripts(){
        return gulp.src(
            ['node_modules/vss-web-extension-sdk/lib/*']
        ).pipe(gulp.dest('./dist/' + env + '/lib/'));
    }
}

function copyDynamicFiles(env, templateData){
    return function BuildAndCopyDynamicFiles(){
        let task = gulp.src(['index.html', 'dropPlan-settings.html','vss-extension.json'])

        templateData.forEach(function(data, index){
            task.pipe(replace(data.Key, data.Value));
        });
        task.pipe(gulp.dest('./dist/' + env));
        return task;
    }
}
let watch = function(done){
    build( () => {
        /*livereload.listen();*/
        gulp.watch('scripts/**/*.js', Development.Scripts);
        gulp.watch('Styles/**/*.css', Development.Styles);
        gulp.watch('Styles/**/*.css', copyStaticFiles(Development.Env));
        gulp.watch('images/**/*.*', copyStaticFiles(Development.Env));
        gulp.watch('*.html', copyDynamicFiles(Development.Env, [
            {Key: '#{now}', Value: new Date().toJSON()},
            {Key: '#{testing-flag}', Value: '-test'},
            {Key: '#{beta-flag}', Value: '.0'},
            {Key: '"public": false', Value: '"public": false'},
            {Key: '"yanivsegev"', Value: '"' + publisherId + '"'},
            {Key: '"uri": "index.html"', Value: '"uri": "https://localhost:8080"'},
            {Key: '"uri": "dropPlan-settings.html"', Value: '"uri": "https://localhost:8080/dropPlan-settings.html"'},
            {Key: '#{isMinified}', Value: ''}
        ]));

        webserver({
                root: './dist/dev',
                livereload: true,
                directoryListing: false,
                open: false,
                https: true,
                port: 8080
            });

        done();
    });
}
let build = gulp.series(
    clean,
    gulp.parallel(
        Development.Styles,
        Development.Scripts,
        copyNodeScripts(Development.Env),
        copyStaticFiles(Development.Env),
        copyNodeScripts(Production.Env),
        copyStaticFiles(Production.Env),
        copyNodeScripts(QA.Env),
        copyStaticFiles(QA.Env),
        copyDynamicFiles(Development.Env, [
            {Key: '#{now}', Value: new Date().toJSON()},
            {Key: '#{testing-flag}', Value: '-test'},
            {Key: '#{beta-flag}', Value: '.'+loadBuildVersion()},
            {Key: '"public": false', Value: '"public": false'},
            {Key: '"yanivsegev"', Value: '"' + publisherId + '"'},
            {Key: '"uri": "index.html"', Value: '"uri": "https://localhost:8080"'},
            {Key: '"uri": "dropPlan-settings.html"', Value: '"uri": "https://localhost:8080/dropPlan-settings.html"'},
            {Key: '#{isMinified}', Value: ''}
        ]),
        copyDynamicFiles(QA.Env, [
            {Key: '#{now}', Value: new Date().toJSON()},
            {Key: '#{testing-flag}', Value: '-test'},
            {Key: '#{testing-flag}', Value: ''},
            {Key: '#{beta-flag}', Value: '.'+loadBuildVersion()},
            {Key: '"public": false', Value: '"public": false'},
            {Key: '"yanivsegev"', Value: '"' + publisherId + '"'},
            {Key: '#{isMinified}', Value: '.min'}
        ]),
        copyDynamicFiles(Production.Env, [
            {Key: '#{now}', Value: new Date().toJSON()},
            {Key: '#{testing-flag}', Value: ''},
            {Key: '#{beta-flag}', Value: ''},
            {Key: '"public": false', Value: '"public": true'},
            //{Key: '"yanivsegev"', Value: '"yanivsegev"'},
            //{Key: '"uri": "index.html"', Value: '"uri": "index.html"'},
            {Key: '#{isMinified}', Value: '.min'}
        ])
    ),
    gulp.parallel(
        QA.Scripts,
        QA.Styles,
        Production.Scripts,
        Production.Styles
    )
);

const styles = Development.Styles;
const scripts = Development.Scripts;

export default build;
export {watch, build as buildAll, clean, styles, scripts};