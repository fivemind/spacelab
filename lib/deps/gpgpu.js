/*

EXPERIMENTAL GPGPU FOR NODEJS AND BROWSER

Copyright (c) 2015 Simon Cullen, simon@bentham.st

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

*/

var GLSLBLOCK = /\/\*\!([\S\s]*?)\*\//gm;
var GLSLLINE = /\/\/\!(.+?)$/gm;
var GLSLTHIS = new RegExp('this\.([a-zA-Z0-9_]+)','gm');
var GLSLREGEX = new RegExp('(?:' + GLSLLINE.source + ')|(?:' + GLSLBLOCK.source + ')', 'gm');

var COMMENTLINE = /(?:^|\s)\/\/(.+?)$/gm;

var createGlContext = require('gl');

var tmpGlContext = createGlContext(1, 1);
var MAX_TEXTURE_SIZE = tmpGlContext.getParameter(tmpGlContext.MAX_TEXTURE_SIZE);
tmpGlContext = null;

var Parallel = function(processes, pages, funct) {

  this.glsl = '';

  this.beforeId = 0;
  this.actionId = 0;
  this.afterId = 0;

  this.befores = [];
  this.actions = [];
  this.afters = [];

  this.pageTextures = [];
  this.pageFrames = [];
  this.pageIndex = {};

  this.config = {
    precision: 'mediump float'
  };

  this.processes = processes;

  var length = Math.pow(2, Math.ceil(Math.log(processes) / Math.LN2));

  length = Math.max(2, length);

  this.frameHeight = 1;
  this.frameWidth = Math.min(length, MAX_TEXTURE_SIZE);

  this.buffer = new Uint8Array(this.frameHeight * this.frameWidth * 4);
  this.segments = Math.ceil(processes / (this.frameHeight * this.frameWidth));

  var gl = this.gl = createGlContext(this.frameWidth, this.frameHeight, { preserveDrawingBuffer: true });

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  this.import('global', funct);

  this._allocate('frame');

  for(var i = 0, ii = pages.length; i < ii; i++) {
    this._allocate(pages[i]);
  }

  this._compile();

};

Parallel.prototype._compileShader = function(gl, type, src) {
  var shader = gl.createShader(type);

  gl.shaderSource(shader, src);

  gl.compileShader(shader);

  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {

    var error = new Error(gl.getShaderInfoLog(shader) + ":" + src);

    gl.deleteShader(shader);

    throw error;

  }

  return shader;
};

Parallel.prototype._setupShader = function(gl, vert_src, frag_src) {
  var fragShader = this._compileShader(gl, gl.FRAGMENT_SHADER, frag_src);
  var vertShader = this._compileShader(gl, gl.VERTEX_SHADER, vert_src);
  var program = gl.createProgram();

  gl.attachShader(program, fragShader);
  gl.attachShader(program, vertShader);

  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {

    var error = new Error(gl.getProgramInfoLog(program));

    gl.deleteProgram(program);

    throw error;

  }

  return program;
};

Parallel.prototype._compile = function() {
  var pageName;
  var pageIndex;
  var samplerLocation;

  var vertShaderGlsl = 'attribute vec4 a_position;';
  var fragShaderGlsl = '';

  var i = 0;
  var ii = 0;

  var gl = this.gl;

  var befores = this.befores;
  var actions = this.actions;
  var afters = this.afters;

  this.glsl = 'precision ' + this.config.precision + '; varying vec2 v_texCoord;';
  for(pageName in this.pageIndex) {
    this.glsl += 'uniform sampler2D ' + pageName + ';';
  }
  this.global();
  vertShaderGlsl += fragShaderGlsl = this.glsl;

  this.glsl = '';
  for (i = 0, ii = befores.length; i < ii; i++) { befores[i](); }
  vertShaderGlsl += this.glsl;

  vertShaderGlsl += 'void main(){gl_Position = a_position; v_texCoord = a_position.xy * 0.5 + 0.5;';
  for (i = 0, ii = this.beforeId; i < ii; i++) {
    vertShaderGlsl += 'before' + i + '();';
  }
  vertShaderGlsl += '}';

  this.glsl = '';
  for (i = 0, ii = actions.length; i < ii; i++) { actions[i](); }
  fragShaderGlsl += this.glsl;

  this.glsl = '';
  for (i = 0, ii = afters.length; i < ii; i++) { afters[i](); }
  fragShaderGlsl += this.glsl;

  fragShaderGlsl += 'void main(){';
  for (i = 0, ii = this.actionId; i < ii; i++) {
      fragShaderGlsl += 'action' + i + '();';
  }
  for (i = 0, ii = this.afterId; i < ii; i++) {
      fragShaderGlsl += 'after' + i + '();';
  }
  fragShaderGlsl += '}';

  var program = this._setupShader(gl, vertShaderGlsl, fragShaderGlsl);

  gl.useProgram(program);

  for(pageName in this.pageIndex) {

    samplerLocation = gl.getUniformLocation(program, pageName);

    if (samplerLocation === null) {
      continue;
    }

    pageIndex = this.pageIndex[pageName];

    gl.uniform1i(samplerLocation, pageIndex);

  }

};

Parallel.prototype.execute = function() {
  var frameWidth = this.frameWidth;
  var frameHeight = this.frameHeight;
  var pages = Object.keys(this.pageIndex);

  var i = 0;
  var j = 0;
  var p = 0;
  var ii = 0;
  var jj = frameWidth * frameHeight * 4;
  var pp = pages.length;
  var gl = this.gl;
  var off = 0;
  var buffer = this.buffer;
  var frame = this.detach('frame');

  for (i = 0, ii = this.segments; i < ii; i++) {

    for (p = 0; p < pp; p++) {
      this.attach(pages[p], i);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.readPixels(0, 0, frameWidth, frameHeight, gl.RGBA, gl.UNSIGNED_BYTE, buffer);

    for (j = 0; j < jj; j++) {
      frame[off + j] = buffer[j];
    }

    off += jj;

  }

  return frame;
};

Parallel.prototype._parse = function(funct) {
  var prefix;
  var tempFrag;
  var glslFrag;
  var thisFrag;
  var commentFrag;
  var thisFrags;
  var source = typeof funct === 'function' ? funct.toString() : '' + funct;
  var template = source;

  var i = 0;
  var ii = 0;

  GLSLREGEX.lastIndex = 0;

  while((glslFrag = GLSLREGEX.exec(source)) !== null) {

    GLSLTHIS.lastIndex = 0;
    COMMENTLINE.lastIndex = 0;

    tempFrag = glslFrag[0];

    prefix = tempFrag.substr(0, 3);

    if (prefix === '/*!') {

      while((commentFrag = COMMENTLINE.exec(tempFrag)) !== null) {
        tempFrag = tempFrag.replace(commentFrag[0], '');
      }

    }

    thisFrags = [];

    while((thisFrag = GLSLTHIS.exec(tempFrag)) !== null) {
      if (thisFrags.indexOf(thisFrag[0]) === -1) {
        thisFrags.push(thisFrag[0]);
      }
    }

    for (i = 0, ii = thisFrags.length; i < ii; i++) {
      tempFrag = tempFrag.split(thisFrags[i]).join('"+' + thisFrags[i] + '+"');
    }

    switch(prefix) {
      case '/*!':
        template = template.replace(
          glslFrag[0], 'this.out("' + tempFrag.substr(3, tempFrag.length - 5) + '");'
        );
        template = template.replace(/[\r\n]/g, '');
        break;
      case '//!':
        template = template.replace(
          glslFrag[0], 'this.out("' + tempFrag.substr(3, tempFrag.length - 3) + '");'
        );
        break;
    }
  }

  return template.slice(template.indexOf('{') + 1, template.lastIndexOf('}'));
};

Parallel.prototype.import = function(name, funct) {
  var template = new Function(this._parse(funct));
  this[name] = template;
};

Parallel.prototype.out = function(string) {
  this.glsl += string;
};

Parallel.prototype.require = function(path) {
  var item;
  var template;
  var module = require(path);

  for (var k in module) {

    item = module[k];

    if (typeof item !== 'function') {
      this[k] = item;
      continue;
    }

    GLSLREGEX.lastIndex = 0;

    if (!GLSLREGEX.exec(item.toString())) {
      this[k] = item;
      continue;
    }

    Object.defineProperty(this, k, {
      set: function() {},
      get: new Function(this._parse(item) + 'return "";')
    });

  }

};

Parallel.prototype.precision = function(string) {
  this.config.precision = string;
};

Parallel.prototype.before = function(funct) {
  var template = 'this.out("void before' +
    (this.beforeId++) + '() {"); ' +
    this._parse(funct) +
    ' this.out("}");';

  this.befores.push( (new Function(template)).bind(this) );

};

Parallel.prototype.action = function(funct) {
  var template = 'this.out("void action' +
    (this.actionId++) + '() {"); ' +
    this._parse(funct) +
    ' this.out("}");';

  this.actions.push( (new Function(template)).bind(this) );

};

Parallel.prototype.after = function(funct) {
  var template = 'this.out("void after' +
    (this.afterId++) + '() {"); ' +
    this._parse(funct) +
    ' this.out("}");';

  this.afters.push( (new Function(template)).bind(this) );

};

Parallel.prototype._allocate = function(pageName) {
  var gl = this.gl;
  var pageTexture = gl.createTexture();

  var pageIndex = this.pageIndex[pageName] = -1 + this.pageTextures.push(pageTexture);

  var frame = this.pageFrames[pageIndex] = new Uint8Array(this.processes * 4);

  gl.bindTexture(gl.TEXTURE_2D, pageTexture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  this[pageName] = 'texture2D(' + pageName + ', v_texCoord)';

  return frame;
};

Parallel.prototype.detach = function(pageName) {
  return this.pageFrames[this.pageIndex[pageName]];
};

Parallel.prototype.attach = function(pageName, segment) {
  var gl = this.gl;
  var frameWidth = this.frameWidth;
  var frameHeight = this.frameHeight;
  var pageIndex = this.pageIndex[pageName];
  var pageFrame = this.pageFrames[this.pageIndex[pageName]];

  gl.activeTexture(gl.TEXTURE0 + pageIndex);
  gl.bindTexture(gl.TEXTURE_2D, this.pageTextures[pageIndex]);

  if (!segment) {

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      frameWidth,
      frameHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pageFrame
    );

    return;

  }

  var buffer = this.buffer;
  var off = segment * frameHeight * frameWidth * 4;

  for (var i = 0, ii = frameHeight * frameWidth * 4; i < ii; i++) {
    buffer[i] = pageFrame[off + i];
  }

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    frameWidth,
    frameHeight,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    buffer
  );

};

module.exports = {
  Parallel: Parallel
};
