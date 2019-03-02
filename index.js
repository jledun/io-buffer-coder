'use strict';

const util = require('util');
const fs = require('fs');
const stat = util.promisify(fs.stat);
const path = require('path'); 
// const Buffer = require('buffer');
const typeDefinitions = require('./type-definitions.json');

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
    tmp = tmp.concat(
      (field.hasOwnProperty('properties')) ? flattenBDF(field.properties) : 
      (field.hasOwnProperty('array')) ? 
        flattenBDF(field.array).map(
          arrayItem => flattenBDF(arrayItem)
        ) :
      field
    );
  });
  return tmp;
}

const flattenData = (data, bdf) => {
  let tmp = [];
  data.values().forEach(key => {
    è
  });
  return tmp;
}

const getTypeField = (plctype) => {
  return typeDefinitions.find(
    typedef => plctype.type.indexOf(typedef.plctype) > -1
  );
}

const getFieldLength = (plctype) => {
  const typeDef = getTypeField(plctype);
  return (plctype.type.indexOf('ARRAY') > -1) ?
    plctype.length * typeDef.length :
    (plctype.length) ? plctype.length : typeDef.length;
}

const checkTypeField = (plctype) => {
  if (!plctype.hasOwnProperty('name') || plctype.name === "") throw new Error(`missing or empty name`, plctype);
  if (!plctype.hasOwnProperty('type') || plctype.type === "") throw new Error(`missing or empty type`, plctype);
  if (!plctype.hasOwnProperty('offset')) throw new Error(`missing offset`, plctype);
  if (typeof getTypeField(plctype) === "undefined") throw new Error(`Type does not exist`, plctype);
  if (plctype.type.indexOf('BOOL') > -1 && !plctype.hasOwnProperty('bitnumber')) throw new Error(`missing 'bitnumber' field`, plctype);
  if (plctype.type.indexOf('STRING') > -1 && (!plctype.hasOwnProperty('length') || plctype.length <= 0)) throw new Error(`missing or null length`, plctype);
  if (plctype.type.indexOf('ARRAY') > -1 && (!plctype.hasOwnProperty('length') || plctype.length <= 0)) throw new Error(`missing or null length`, plctype);
  return true;
}

const checkBDFTypes = (bdf) => {
  let tmp = true;
  const flattened = flattenBDF(bdf);
  for (let i = 0; i < flattened.length; i++) {
    if (flattened[i].hasOwnProperty('properties')) {
      if (!Array.isArray(flattened[i].properties)) throw new Error(`Bad definition file : 'properties (${flattened[i].name})' must provide an array of properties.`);
      tmp = tmp && checkBDFTypes(flattened[i].properties);

    }else if (flattened[i].hasOwnProperty('array')) {
      if (!Array.isArray(flattened[i].array)) throw new Error(`Bad definition file : 'array (${flattened[i].name})' must provide an array.`);
      flattened[i].array.forEach(arrBdf => {
        tmp = tmp && checkBDFTypes(arrBDF);
      });

    }else{
      tmp = tmp && checkTypeField(flattened[i]);
    }
    if (!tmp) return tmp;
  }
  return tmp;
}

const checkData = (data, bdf) => {
  // check if data respects the definition file structure
  if (data === null || data === undefined) throw new Error(`Nothing to encode`);
  if (typeof data !== "object") throw new Error(`data must be an object`);
}

const checkBuffer = (buffer, bdf) => {
  // check buffer
  if (buffer === null || buffer === undefined) throw new Error(`Nothing to decode`);
  if (!Buffer.isBuffer(buffer)) throw new Error(`buffer is not a Buffer`);
  const lastDef = flattenBDF(bdf).pop();
  const totalLength = lastDef.offset + getFieldLength(lastDef);
  if (buffer.length !== totalLength) throw new Error(`buffer length is not what it should be.`);
}

const init = (defPath) => {
  return new Promise(async (resolve, reject) => {
    try{
      const bdf = await getFileDescription(defPath);
      checkBDFTypes(bdf);
      return resolve(bdf);
    }catch(e){
      return reject(e);
    }
  });
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
        const bdf = await init(defPath);
        checkData(data, bdf);
        return resolve(bdf);
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
        const bdf = await init(defPath);
        checkBuffer(buffer, bdf);
        return resolve(bdf);
      }catch(e){
        return reject(e);
      }
    });
  }
}

module.exports = BufferWorker;

