'use strict';

var fs = require('fs');

var original = './easylist.txt';
var compiled = '../src/data/filter/filters.json';
var style_b = '../src/data/content_script/inject_f_b.css';
var style_h = '../src/data/content_script/inject_f_h.css';

function read (path, callback) {
  fs.readFile(original, function (err, data) {
    if (err) {
      throw err;
    }
    callback(data);
  });
}

function write (path, content, callback) {
  fs.writeFile(path, content, function (err) {
    if (err) {
      throw err;
    }
    if (callback) {
      callback();
    }
  });
}

function cleanup (list) {
  return list
  .filter(function (item) {
    return item && item[0] !== '[' && item[0] !== '!';
  })
  .filter(function (item) {
    return item.indexOf('#@#') === -1;
  })
  .filter(function (item) { /* we do not accept regex patterns yet */
    var tmp = item.indexOf('a-z') === -1 && item.indexOf('{2}');
    if (!tmp) {
      console.error('[regex] ', item);
    }
    return tmp;
  });
}

function extractKeyword (str) {
  return str
    .split('$').shift()
    .replace('@@||', '^')
    .replace('@@|', '^')
    .replace('@@', '^')
    .replace('||', '^')
    .replace('|', '^')
    .replace('*', '^')
    .replace(',', '^')
    .split('^')
    .filter(function (q) {
      return q;
    })[0];
}

var len = 9, ignored = 0;

read(original, function (content) {
  console.error("Step #0");
  
  content += '';
  var list = content.split(/\r?\n/);
  list = cleanup(list);
  
  console.error("Step #1");
  
  var keywords = list.map(extractKeyword).filter(function (keyword, i) {
    var tmp = keyword.length >= len; /* accept 9 char length keyboards */
    if (!tmp) {
      ignored += 1;
      console.log('[ignoring]', ignored, list[i]);
    }
    return tmp;
  });

  console.error("Step #2");
  
  var shortKeywords = keywords.map(function (keyword) {
    return keyword.length < len ? keyword : keyword.substr(0, len);
  })
  .filter(function (k_keyword, i_index, l_list) {return l_list.indexOf(k_keyword) === i_index});

  console.error("Step #3");
  
  var objs = {}, z = 0, css = [];
  list.forEach(function (item) {
    var short_keyword = shortKeywords.reduce(function (p, c) {
      return p || (item.indexOf(c) !== -1 ? c : null);
    }, null);
    objs[short_keyword] = objs[short_keyword] || {};
    var list_item = extractKeyword(item);
    objs[short_keyword][list_item] = objs[short_keyword][list_item] || [[], []]; 

    if (item.indexOf("##") === 0 || item.indexOf("###") === 0) { /* block by id and class */
      item = item.replace('###', '#').replace('##', '');
      css.push(item);
    }
    else if (item.indexOf("#@#") > 0) { /* block by id and class on specific site */
      /* not supported yet */
    }
    else { /* domain specific block and general hide */
      var tmp = item.split('$');
      var blocking_expression = tmp[0];
      var exceptions = tmp[1] ? tmp[1].split(',') : [];
      if (blocking_expression.substr(0, 2) === '@@') { /* @@ is a tag for whitelist */
        var arr = [blocking_expression.replace('@@||', '||').replace('@@|', '||'), exceptions];
        objs[short_keyword][list_item][0].push(arr);
      }
      else {
        objs[short_keyword][list_item][1].push([blocking_expression, exceptions]);
      }
    }
  });
  
  console.error("Step #4");
  
  var ruleList_b = [], ruleList_h = [];
  for (var i = 0; css.length > 0; i++) {
    var cssBlock = css.splice(0, 19).join(',\n');
    var selector_b = cssBlock + " {\n   display:none !important;\n   visibility: hidden !important; \n }";
    var selector_h = cssBlock + " {\n   color: red !important; \n   border: solid 2px red !important; \n   background-color: #FFE987 !important; \n }";
    ruleList_b.push(selector_b);
    ruleList_h.push(selector_h);
  }
  
  console.error("Step #5");
  
  write(style_b, ruleList_b.join('\n'));
  write(style_h, ruleList_h.join('\n'));
  write(compiled, JSON.stringify(objs));
  
  console.error("Step #6");
});
