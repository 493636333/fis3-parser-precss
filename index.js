var postcss = require('postcss');
var precss = require('precss');
var postcssScss = require('postcss-scss');
var calc = require('postcss-calc');
var prettify = require('postcss-prettify');
var functions = require('postcss-functions');
var autoprefixer = require('autoprefixer');
var color = require('color');

function clamp(val) {
    return Math.min(100, Math.max(0, val));
}

function addDepends(file, messages) {
  if (!file.cache) {
    return;
  }

  var deps = [file.realpath];

  messages.forEach(function(message) {
    if (message.type === 'dependency' && ~deps.indexOf(message.parent)) {
      deps.push(message.file);
      file.cache.addDeps(message.file);
    }
  });
}

module.exports = function(content, file, conf, callback) {
  if (!callback) {
    throw new Error('Async plugin is not supported in `fis3`, please use `fis3-async`。');
  }

  var processConf = fis.util.assign({
    parser: postcssScss,
    from: file.subpath.substring(1)
  }, conf.sourceMap ? {
    map: {
      inline: false
    }
  } : null);

  postcss([
    precss(conf),
    calc(),
    functions({
      functions: {
          lighten: function (value, percentage) {
              var hsl = color(value.trim()).hsl();
              hsl.color[2] += parseFloat(percentage);
              hsl.color[2] = clamp(hsl.color[2]);
              return hsl.rgb().toString();
          },
          darken: function (value, percentage) {
              var hsl = color(value.trim()).hsl();
              hsl.color[2] -= parseFloat(percentage);
              hsl.color[2] = clamp(hsl.color[2]);
              return hsl.rgb().toString();
          },
          saturate: function (value, percentage) {
              var hsl = color(value.trim()).hsl();
              hsl.color[1] += parseFloat(percentage);
              hsl.color[1] = clamp(hsl.color[1]);
              return hsl.rgb().toString();
          },
          desaturate: function (value, percentage) {
              var hsl = color(value.trim()).hsl();
              hsl.color[1] -= parseFloat(percentage);
              hsl.color[1] = clamp(hsl.color[1]);
              return hsl.rgb().toString();
          }
      }
    }),
    autoprefixer,
    prettify()
  ])
    .process(content, processConf)
    .then(function (ret) {
      content = ret.css;

      addDepends(file, ret.messages);
      
      if (ret.map) {
        var mapping = fis.file.wrap(file.dirname + '/' + file.filename + file.rExt + '.map');
    
        // 修改 source 文件名。
        // var sourceMapObj = JSON.parse(ret.map.toString('utf8'));
        // sourceMapObj.sources[0] = file.subpath;
        // mapping.setContent(JSON.stringify(sourceMapObj, null, 4));
        mapping.setContent(ret.map);
        
        var url = mapping.getUrl(fis.compile.settings.hash, fis.compile.settings.domain);
    
        content = ret.css.replace(/\n?\s*\/\*#\ssourceMappingURL=.*?(?:\n|$)/g, '');
        content += '\n/*# sourceMappingURL=' +  url + '*/\n';
    
        file.extras = file.extras || {};
        file.extras.derived = file.extras.derived || [];
        file.extras.derived.push(mapping);
      }
      callback(null, content);
    }).catch(callback);
}

module.exports.defaultOptions = {
  sourceMap: false,
  'import': {
    extension: '.pcss'
  }
};
