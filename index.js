'use strict';

const util = require('util');
const fs = require('fs');
const stat = util.promisify(fs.stat);
const path = require('path'); 

const getFileDescription = (bufferDescriptionFilePath) => {
  return new Promise(async (resolve, reject) => {
    if (!bufferDescriptionFilePath) return reject(new Error(`Description file path is not defined.`));
    const p = (!path.isAbsolute(bufferDescriptionFilePath)) ?
      path.parse(path.resolve(__dirname, bufferDescriptionFilePath)) :
      path.parse(bufferDescriptionFilePath);
    try{
      const bdfStat = await stat(path.format(p));
      if (!bdfStat.isFile()) return reject(`${bufferDescriptionFilePath} is not a regular file.`);
      return resolve(require(path.format(p)));
    }catch(e) {
      return reject(e);
    }
  });
}

const flattenBDF = (bdf) => {
  if (!bdf) throw new Error(`Buffer description file is empty.`);
  if (!Array.isArray(bdf)) throw new Error(`Description file must be an array.`);
  let tmp = [];
  bdf.forEach(field => {
    tmp = tmp.concat((field.hasOwnProperty('properties')) ? flattenBDF(field.properties) : field);
  });
  return tmp;
}

const BufferWorker = {
  defaultOptions: {
    endianess: "BE"
  },
  encode: (bufferDescriptionFilePath, data, options) => {
    return new Promise(async (resolve, reject) => {
      const defPath = bufferDescriptionFilePath;
      const opt = {...BufferWorker.defaultOptions, ...options};
      try{
        const bdf = await getFileDescription(defPath);
        return resolve(flattenBDF(bdf));
      }catch(e){
        return reject(e);
      }
    });
  },
  decode: (bufferDescriptionFilePath, buffer, options) => {
    return new Promise(async (resolve, reject) => {
      const defPath = bufferDescriptionFilePath;
      const opt = {...BufferWorker.defaultOptions, ...options};
      try{
        const def = await getFileDescription(defPath);
        return resolve(def);
      }catch(e){
        return reject(e);
      }
    });
  }
}

module.exports = BufferWorker;

